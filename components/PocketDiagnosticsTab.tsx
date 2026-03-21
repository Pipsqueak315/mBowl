import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  ActivityIndicator,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { readSessions } from '@/src/storage';
import { computeLeaveStats } from '@/src/leaveUtils';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FrequencyTier = 'High Frequency' | 'Common' | 'Situational';
type FilterPill = 'All Leaves' | FrequencyTier;
type ViewMode = 'reference' | 'mydata';

interface DiagnosticCard {
  name: string;
  frequency: FrequencyTier;
  why: string;
  fix: string;
  pattern: string;
}

export interface DiagnosticsData {
  cards: DiagnosticCard[];
}

export interface DiagnosticsTabProps {
  data: DiagnosticsData;
  onUpdate: (updated: DiagnosticsData) => void;
  onSave: () => void;
}

interface LeaveEntry {
  name: string;
  count: number;
  converted: number;
  conversionPct: number;
}

interface CardLeaveData {
  count: number;
  converted: number;
  conversionPct: number;
  hasData: boolean;
}

// ---------------------------------------------------------------------------
// Default data
// ---------------------------------------------------------------------------

export const DEFAULT_DIAGNOSTICS: DiagnosticsData = {
  cards: [
    {
      name: 'Ringing 10 pin',
      frequency: 'High Frequency',
      why: 'Entry angle too aggressive. Ball drives through the 6 and deflects past the 10.',
      fix: 'Move left 1 board or step down slightly in strength to tighten entry angle.',
      pattern:
        "If it's happening every time you strike, your angle is too sharp. It's a success diagnostic, not a miss.",
    },
    {
      name: 'Solid 8 pin',
      frequency: 'High Frequency',
      why: 'Hit too flush. Ball deflects straight back through the 5 instead of driving diagonally into the 8.',
      fix: 'Move right 1 board or use a ball with more backend to sharpen entry angle.',
      pattern:
        'Consistent solid 8s mean your entry is too flat. Check your ball path, not your spare shooting.',
    },
    {
      name: 'Ringing 7 pin',
      frequency: 'High Frequency',
      why: 'Hit too high on the headpin. 2-pin kicks the 4, but the 4 misses the 7.',
      fix: 'Move right 1–2 boards to hit the headpin slightly lighter and drive pins left.',
      pattern:
        "Pairs with ringing 10 — if you're getting both, your line is too direct. Open up slightly.",
    },
    {
      name: 'Big 4 (4-6-7-10)',
      frequency: 'High Frequency',
      why: 'High flush hit with zero angle. Ball drives straight through without spreading pins.',
      fix: 'Critical read — your ball is going straight in. Revisit your entire line.',
      pattern:
        'If this happens more than once in a session, stop adjusting feet and change the ball.',
    },
    {
      name: '6-7-10',
      frequency: 'High Frequency',
      why: 'Extreme high hit. 6-pin knocked flat across both corners.',
      fix: 'Very light hit — move right 2+ boards to hit fuller on the headpin.',
      pattern:
        "Rare. If you see it twice in a night, you're playing too straight or too far outside.",
    },
    {
      name: 'Washout',
      frequency: 'High Frequency',
      why: 'Missed the headpin. Ball went high or wide, leaving a non-pocket split with the headpin.',
      fix: 'Execution miss — headpin must be hit for a washout to become a spare.',
      pattern:
        'Recurring washouts = inconsistent release or misread on the line. Check your target.',
    },
    {
      name: 'Corner pin (7 or 10)',
      frequency: 'Common',
      why: 'Slightly light hit leaving the far corner. Common on good shots — not always a ball issue.',
      fix: 'Not necessarily a problem. If consistent, fine-tune entry angle by 1 board.',
      pattern:
        "If you're leaving the same corner 3+ times in a session, it's a pattern. Move 1 board toward that corner.",
    },
    {
      name: '2-8-10 bucket',
      frequency: 'Common',
      why: "Light hit on the headpin. 2-pin kicks back to the 8 but doesn't bridge to the 10.",
      fix: 'Move left 1–2 boards to hit fuller and drive the 2-pin harder.',
      pattern:
        "Buckets are a light-hit diagnostic. If it's recurring, you're missing your target right.",
    },
    {
      name: '2-4-5-8 bucket',
      frequency: 'Common',
      why: 'Entry angle too inside. Ball hits the 1-2 pocket with insufficient angle to scatter the cluster.',
      fix: 'Open your angle — move left, target deeper, hit the 2-pin more squarely.',
      pattern: "Repeat buckets on this side = you're playing too far inside. Open up.",
    },
    {
      name: '4-6 split',
      frequency: 'Common',
      why: 'Dead flush hit, zero entry angle. Ball goes straight through without deflecting pins outward.',
      fix: 'Carry issue — check entry angle first, then consider a sharper backend ball.',
      pattern:
        "If this shows up early in a set, your line is too direct. You need angle, not more speed.",
    },
    {
      name: '5-7 split',
      frequency: 'Common',
      why: 'Light left hit. Headpin deflects right, 5-pin goes left and misses the 7.',
      fix: 'Move right slightly to hit fuller and drive the headpin left into the 7.',
      pattern: 'Consistent 5-7s = missing left. Your target is drifting.',
    },
    {
      name: 'Baby split (2-7 or 3-10)',
      frequency: 'Common',
      why: 'Slightly light or slightly wide hit. One pin deflects the wrong direction.',
      fix: 'Adjust 1 board toward the missed side. Execution more than ball.',
      pattern:
        "If you're getting the same baby split repeatedly, your ball is missing the same direction every time.",
    },
    {
      name: '4-7-9 cluster',
      frequency: 'Common',
      why: 'Hit too far left of the pocket. Ball deflected left side pins but left a cluster.',
      fix: 'Move right to hit more toward the pocket center.',
      pattern:
        "Consistent 4-7-9 = you're pulling the ball or your feet are too far left.",
    },
    {
      name: 'Sleeper pocket (2-8 or 3-9)',
      frequency: 'Situational',
      why: "Hit the pocket but the 5-pin didn't fall. Light hit or deflection loss.",
      fix: 'Increase entry angle or step up in ball strength to drive through the 5-pin harder.',
      pattern:
        "If it shows up in Game 3, your ball is losing energy. Time to switch.",
    },
  ],
};

// ---------------------------------------------------------------------------
// Leave name mapping — diagnostic card name → leaveUtils leave name(s)
// ---------------------------------------------------------------------------

const CARD_LEAVE_KEYS: Record<string, string[]> = {
  'Ringing 10 pin':           ['10 Pin'],
  'Solid 8 pin':              ['8 Pin'],
  'Ringing 7 pin':            ['7 Pin'],
  'Big 4 (4-6-7-10)':        ['Big 4'],
  '6-7-10':                   ['6-7-10'],
  'Washout':                  [],
  'Corner pin (7 or 10)':     ['7 Pin', '10 Pin'],
  '2-8-10 bucket':            ['2-8-10 Bucket'],
  '2-4-5-8 bucket':           ['2-4-5-8 Bucket'],
  '4-6 split':                ['4-6 Split'],
  '5-7 split':                ['5-7 Split'],
  'Baby split (2-7 or 3-10)': ['Baby Split (2-7)', 'Baby Split (3-10)'],
  '4-7-9 cluster':            ['4-7-9 Cluster'],
  'Sleeper pocket (2-8 or 3-9)': ['Sleeper (2-8)', 'Sleeper (3-9)'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FILTER_PILLS: FilterPill[] = ['All Leaves', 'High Frequency', 'Common', 'Situational'];

function frequencyColor(tier: FrequencyTier): string {
  if (tier === 'High Frequency') return '#FF453A';
  if (tier === 'Common') return '#FF9F0A';
  return '#FFD60A';
}

function conversionColor(pct: number): string {
  if (pct >= 80) return '#30D158';
  if (pct >= 60) return '#FF9F0A';
  return '#FF453A';
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PocketDiagnosticsTab({
  data,
  onUpdate,
  onSave,
}: DiagnosticsTabProps) {
  const [activeFilter, setActiveFilter] = useState<FilterPill>('All Leaves');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<ViewMode>('reference');
  const [leaveEntries, setLeaveEntries] = useState<LeaveEntry[]>([]);
  const [hasPinData, setHasPinData] = useState(false);
  const [leavesLoading, setLeavesLoading] = useState(true);

  // Load all-time leave data on mount
  useEffect(() => {
    readSessions().then(sessions => {
      if (!sessions) {
        setHasPinData(false);
        setLeaveEntries([]);
        setLeavesLoading(false);
        return;
      }
      const result = computeLeaveStats(sessions as unknown[]) as {
        leaves: LeaveEntry[];
        hasPinData: boolean;
      };
      setHasPinData(result.hasPinData);
      setLeaveEntries(result.leaves);
      setLeavesLoading(false);
    });
  }, []);

  // ---- Helpers --------------------------------------------------------------

  function getCardLeaveData(cardName: string): CardLeaveData {
    const keys = CARD_LEAVE_KEYS[cardName] ?? [];
    if (keys.length === 0) return { count: 0, converted: 0, conversionPct: 0, hasData: false };

    let totalCount = 0;
    let totalConverted = 0;
    for (const key of keys) {
      const entry = leaveEntries.find(l => l.name === key);
      if (entry) {
        totalCount += entry.count;
        totalConverted += entry.converted;
      }
    }
    if (totalCount === 0) return { count: 0, converted: 0, conversionPct: 0, hasData: false };
    return {
      count: totalCount,
      converted: totalConverted,
      conversionPct: (totalConverted / totalCount) * 100,
      hasData: true,
    };
  }

  const visibleCards =
    activeFilter === 'All Leaves'
      ? data.cards
      : data.cards.filter(c => c.frequency === activeFilter);

  // Original index needed so patches update the right card in data.cards
  const visibleWithIndex = visibleCards.map(card => ({
    card,
    originalIndex: data.cards.indexOf(card),
  }));

  // My Data: annotate with leave data and sort (data first desc, zeros at bottom)
  const myDataItems = visibleWithIndex
    .map(item => ({ ...item, leaveData: getCardLeaveData(item.card.name) }))
    .sort((a, b) => {
      if (a.leaveData.hasData && !b.leaveData.hasData) return -1;
      if (!a.leaveData.hasData && b.leaveData.hasData) return 1;
      return b.leaveData.count - a.leaveData.count;
    });

  const maxCount = myDataItems.reduce((m, item) => Math.max(m, item.leaveData.count), 0);

  // ---- Actions -------------------------------------------------------------

  function toggleCard(originalIndex: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(originalIndex) ? next.delete(originalIndex) : next.add(originalIndex);
      return next;
    });
  }

  function patchCard(i: number, patch: Partial<Pick<DiagnosticCard, 'why' | 'fix' | 'pattern'>>) {
    onUpdate({
      cards: data.cards.map((card, idx) => (idx === i ? { ...card, ...patch } : card)),
    });
  }

  function handleFilterChange(pill: FilterPill) {
    setActiveFilter(pill);
    setExpanded(new Set());
  }

  // ---- Shared expanded body ------------------------------------------------

  function renderExpandedBody(card: DiagnosticCard, originalIndex: number) {
    return (
      <View style={s.expandedBody}>
        <View style={s.separator} />

        <View style={s.fieldBlock}>
          <Text style={s.fieldLabel}>WHY IT HAPPENS</Text>
          <TextInput
            style={s.fieldInput}
            value={card.why}
            onChangeText={v => patchCard(originalIndex, { why: v })}
            onBlur={onSave}
            multiline
            textAlignVertical="top"
            placeholder="Root cause..."
            placeholderTextColor="#48484A"
          />
        </View>

        <View style={s.fieldBlock}>
          <Text style={s.fieldLabel}>FIX</Text>
          <TextInput
            style={s.fieldInput}
            value={card.fix}
            onChangeText={v => patchCard(originalIndex, { fix: v })}
            onBlur={onSave}
            multiline
            textAlignVertical="top"
            placeholder="Adjustment to make..."
            placeholderTextColor="#48484A"
          />
        </View>

        <View style={[s.fieldBlock, s.lastFieldBlock]}>
          <Text style={s.fieldLabel}>PATTERN TO WATCH</Text>
          <TextInput
            style={s.fieldInput}
            value={card.pattern}
            onChangeText={v => patchCard(originalIndex, { pattern: v })}
            onBlur={onSave}
            multiline
            textAlignVertical="top"
            placeholder="What recurring instances mean..."
            placeholderTextColor="#48484A"
          />
        </View>
      </View>
    );
  }

  // ---- Render --------------------------------------------------------------

  return (
    <View style={s.container}>
      {/* Mode toggle */}
      <View style={s.modeToggleWrap}>
        <View style={s.modeToggle}>
          <TouchableOpacity
            style={[s.modeBtn, mode === 'reference' && s.modeBtnActive]}
            onPress={() => setMode('reference')}
            activeOpacity={0.8}
          >
            <Text style={[s.modeBtnText, mode === 'reference' && s.modeBtnTextActive]}>
              Reference
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeBtn, mode === 'mydata' && s.modeBtnActive]}
            onPress={() => setMode('mydata')}
            activeOpacity={0.8}
          >
            <Text style={[s.modeBtnText, mode === 'mydata' && s.modeBtnTextActive]}>
              My Data
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter pill bar */}
      <View style={s.pillBar}>
        {FILTER_PILLS.map(pill => (
          <TouchableOpacity
            key={pill}
            style={[s.pill, activeFilter === pill && s.pillActive]}
            onPress={() => handleFilterChange(pill)}
            activeOpacity={0.7}
          >
            <Text style={[s.pillText, activeFilter === pill && s.pillTextActive]}>
              {pill}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ---- Reference mode ---- */}
      {mode === 'reference' && (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
        >
          {visibleWithIndex.map(({ card, originalIndex }) => {
            const isOpen = expanded.has(originalIndex);
            return (
              <View key={originalIndex} style={s.card}>
                <TouchableOpacity
                  style={s.cardHeader}
                  onPress={() => toggleCard(originalIndex)}
                  activeOpacity={0.7}
                >
                  <Text style={s.cardName}>{card.name}</Text>
                  <View style={[s.freqDot, { backgroundColor: frequencyColor(card.frequency) }]} />
                  <Text style={[s.chevron, isOpen && s.chevronOpen]}>›</Text>
                </TouchableOpacity>

                {isOpen && renderExpandedBody(card, originalIndex)}
              </View>
            );
          })}
          <View style={s.bottomSpacer} />
        </ScrollView>
      )}

      {/* ---- My Data mode ---- */}
      {mode === 'mydata' && (
        <>
          {leavesLoading ? (
            <View style={s.naState}>
              <ActivityIndicator color="#00CEC9" />
            </View>
          ) : !hasPinData ? (
            <View style={s.naState}>
              <IconSymbol name="lock.fill" size={28} color="#48484A" />
              <Text style={s.naTitle}>No pin data yet</Text>
              <Text style={s.naSubtitle}>
                Log frames with pin tracking to unlock your leave data.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={s.scroll}
              contentContainerStyle={s.content}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="interactive"
            >
              {myDataItems.map(({ card, originalIndex, leaveData }) => {
                const isOpen = expanded.has(originalIndex);
                const barPct = maxCount > 0 && leaveData.hasData
                  ? leaveData.count / maxCount
                  : 0;
                return (
                  <View
                    key={originalIndex}
                    style={[s.card, !leaveData.hasData && s.cardDimmed]}
                  >
                    <TouchableOpacity
                      style={s.cardHeader}
                      onPress={() => toggleCard(originalIndex)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.cardName, !leaveData.hasData && s.cardNameDim]}>
                        {card.name}
                      </Text>

                      {leaveData.hasData ? (
                        <View style={s.myDataStats}>
                          <Text style={s.myDataCount}>×{leaveData.count}</Text>
                          <Text
                            style={[
                              s.myDataConv,
                              { color: conversionColor(leaveData.conversionPct) },
                            ]}
                          >
                            {Math.round(leaveData.conversionPct)}%
                          </Text>
                        </View>
                      ) : (
                        <Text style={s.myDataNone}>—</Text>
                      )}

                      <View
                        style={[s.freqDot, { backgroundColor: frequencyColor(card.frequency) }]}
                      />
                      <Text style={[s.chevron, isOpen && s.chevronOpen]}>›</Text>
                    </TouchableOpacity>

                    {leaveData.hasData && (
                      <View style={s.myDataBarTrack}>
                        <View
                          style={[
                            s.myDataBar,
                            { width: `${Math.max(barPct * 100, 3)}%` as `${number}%` },
                          ]}
                        />
                      </View>
                    )}

                    {isOpen && renderExpandedBody(card, originalIndex)}
                  </View>
                );
              })}
              <View style={s.bottomSpacer} />
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  // Mode toggle
  modeToggleWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    padding: 3,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: '#00CEC9',
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  modeBtnTextActive: {
    color: '#000000',
  },

  // Filter pill bar
  pillBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8,
    backgroundColor: '#000000',
  },
  pill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: '#00CEC9',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E8E93',
  },
  pillTextActive: {
    color: '#000000',
    fontWeight: '700',
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 40,
  },

  // Card
  card: {
    backgroundColor: '#2C2C2E',
    borderRadius: 13,
    paddingHorizontal: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardDimmed: {
    opacity: 0.4,
  },

  // Collapsed header
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  cardName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardNameDim: {
    color: '#8E8E93',
  },
  freqDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    flexShrink: 0,
  },
  chevron: {
    fontSize: 20,
    color: '#48484A',
    transform: [{ rotate: '90deg' }],
    lineHeight: 22,
    flexShrink: 0,
  },
  chevronOpen: {
    transform: [{ rotate: '-90deg' }],
  },

  // Expanded body
  expandedBody: {
    paddingBottom: 16,
  },
  separator: {
    height: 0.5,
    backgroundColor: '#38383A',
    marginBottom: 14,
  },
  fieldBlock: {
    marginBottom: 14,
  },
  lastFieldBlock: {
    marginBottom: 0,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  fieldInput: {
    fontSize: 14,
    color: '#FFFFFF',
    padding: 0,
    minHeight: 20,
    lineHeight: 20,
  },

  // My Data overlay
  myDataStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  myDataCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  myDataConv: {
    fontSize: 15,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  myDataNone: {
    fontSize: 15,
    color: '#48484A',
    flexShrink: 0,
  },
  myDataBarTrack: {
    height: 3,
    backgroundColor: '#38383A',
    borderRadius: 2,
    marginBottom: 10,
    overflow: 'hidden',
  },
  myDataBar: {
    height: 3,
    backgroundColor: '#00CEC9',
    borderRadius: 2,
  },

  // N/A locked state
  naState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  naTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  naSubtitle: {
    color: '#48484A',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Bottom spacer
  bottomSpacer: {
    height: 40,
  },
});
