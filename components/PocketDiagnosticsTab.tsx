import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  UIManager,
  ActivityIndicator,
} from 'react-native';
import EditableField from '@/components/v2/EditableField';
import { animateNextLayout } from '@/src/v2/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { readSessions } from '@/src/storage';
import { computeLeaveStats } from '@/src/leaveUtils';
import { CARD_LEAVE_KEYS } from '@/src/leaveFixes';
import SegmentedControl from '@/components/v2/SegmentedControl';
import { DIAGNOSTICS_V2 } from '@/src/referenceContent';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FrequencyTier = 'High Frequency' | 'Common' | 'Situational';
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
  isSplit: boolean;
}

interface CardLeaveData {
  count: number;
  converted: number;
  conversionPct: number;
  hasData: boolean;
  /** Every leave behind this card is a split (isSplit, leaveUtils). */
  isSplit: boolean;
}

// ---------------------------------------------------------------------------
// Default data
// ---------------------------------------------------------------------------

export const DEFAULT_DIAGNOSTICS: DiagnosticsData = {
  // Phase 30B (Nov 24): right-handed, short -- src/referenceContent.ts. Card
  // names unchanged (CARD_LEAVE_KEYS + the upgrade key on them).
  cards: DIAGNOSTICS_V2,
};

// ---------------------------------------------------------------------------
// Leave name mapping — diagnostic card name → leaveUtils leave name(s)
// ---------------------------------------------------------------------------

// Phase 30A: moved to src/leaveFixes.ts (shared with the Stats "Leave -> fix" card).

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Phase 30B: the frequency filter row is gone (My Data shows real counts);
// the mode toggle is the shared SegmentedControl.
const MODES = [
  { key: 'reference', label: 'Reference' },
  { key: 'mydata', label: 'My Data' },
] as const satisfies readonly { key: ViewMode; label: string }[];

function frequencyColor(tier: FrequencyTier): string {
  if (tier === 'High Frequency') return '#FF453A';
  if (tier === 'Common') return '#FF9F0A';
  return '#FFD60A';
}

// Phase 31A (D8): same bands as Stats' per-leave rows (leaveConversionColor):
// non-splits 80 / 60; splits green >= 40, orange >= 15, else grey -- never red,
// most splits are low-percentage by nature.
function conversionColor(pct: number, isSplit: boolean): string {
  if (isSplit) {
    if (pct >= 40) return '#30D158';
    if (pct >= 15) return '#FF9F0A';
    return '#8E8E93';
  }
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
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<ViewMode>('reference');
  const [leaveEntries, setLeaveEntries] = useState<LeaveEntry[]>([]);
  const [hasPinData, setHasPinData] = useState(false);
  const [leavesLoading, setLeavesLoading] = useState(true);

  // Load all-time leave data on mount
  useEffect(() => {
    let active = true;
    readSessions().then(sessions => {
      if (!active) return;
      const result = computeLeaveStats(sessions) as {
        leaves: LeaveEntry[];
        hasPinData: boolean;
      };
      setHasPinData(result.hasPinData);
      setLeaveEntries(result.leaves);
      setLeavesLoading(false);
    });
    return () => { active = false; };
  }, []);

  // ---- Helpers --------------------------------------------------------------

  function getCardLeaveData(cardName: string): CardLeaveData {
    const keys = CARD_LEAVE_KEYS[cardName] ?? [];
    const none = { count: 0, converted: 0, conversionPct: 0, hasData: false, isSplit: false };
    if (keys.length === 0) return none;

    let totalCount = 0;
    let totalConverted = 0;
    let allSplits = true;
    for (const key of keys) {
      const entry = leaveEntries.find(l => l.name === key);
      if (entry) {
        totalCount += entry.count;
        totalConverted += entry.converted;
        if (!entry.isSplit) allSplits = false;
      }
    }
    if (totalCount === 0) return none;
    return {
      count: totalCount,
      converted: totalConverted,
      conversionPct: (totalConverted / totalCount) * 100,
      hasData: true,
      isSplit: allSplits,
    };
  }

  const visibleCards = data.cards;

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
    animateNextLayout();
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


  // ---- Shared expanded body ------------------------------------------------

  function renderExpandedBody(card: DiagnosticCard, originalIndex: number) {
    return (
      <View style={s.expandedBody}>
        <View style={s.separator} />

        <EditableField
            label="Why it happens"
            blockStyle={s.fieldBlock}
            labelStyle={s.fieldLabel}
            inputStyle={s.fieldInput}
            value={card.why}
            onChangeText={v => patchCard(originalIndex, { why: v })}
            onBlur={onSave}
            multiline
            textAlignVertical="top"
            placeholder="Root cause..."
            placeholderTextColor="#48484A"
          />

        <EditableField
            label="Fix"
            blockStyle={s.fieldBlock}
            labelStyle={s.fieldLabel}
            inputStyle={s.fieldInput}
            value={card.fix}
            onChangeText={v => patchCard(originalIndex, { fix: v })}
            onBlur={onSave}
            multiline
            textAlignVertical="top"
            placeholder="Adjustment to make..."
            placeholderTextColor="#48484A"
          />

        <EditableField
            label="Pattern to watch"
            blockStyle={[s.fieldBlock, s.lastFieldBlock]}
            labelStyle={s.fieldLabel}
            inputStyle={s.fieldInput}
            value={card.pattern}
            onChangeText={v => patchCard(originalIndex, { pattern: v })}
            onBlur={onSave}
            multiline
            textAlignVertical="top"
            placeholder="What recurring instances mean..."
            placeholderTextColor="#48484A"
          />
      </View>
    );
  }

  // ---- Render --------------------------------------------------------------

  return (
    <View style={s.container}>
      {/* Mode toggle */}
      <View style={s.modeToggleWrap}>
        <SegmentedControl
          segments={MODES}
          value={mode}
          onChange={setMode}
          accessibilityLabel="Pocket Diagnostics view"
        />
      </View>


      {/* ---- Reference mode ---- */}
      {mode === 'reference' && (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
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
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
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
                              { color: conversionColor(leaveData.conversionPct, leaveData.isSplit) },
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
    paddingTop: 4,
    paddingBottom: 12,
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
    backgroundColor: '#1C1C1E', // Phase 30B: same card color as Signals / Mental
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
    fontWeight: '500',
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
  // v2.1 P11: sentence case 13pt (was 10pt all-caps -- theme.ts: no tiny all-caps labels)
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93',
    marginBottom: 4,
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
    fontWeight: '500',
    color: '#8E8E93',
  },
  myDataConv: {
    fontSize: 15,
    fontWeight: '400',
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
