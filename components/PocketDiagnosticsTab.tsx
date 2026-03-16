import { useState } from 'react';
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
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FrequencyTier = 'High Frequency' | 'Common' | 'Situational';
type FilterPill = 'All Leaves' | FrequencyTier;

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
// Helpers
// ---------------------------------------------------------------------------

const FILTER_PILLS: FilterPill[] = ['All Leaves', 'High Frequency', 'Common', 'Situational'];

function frequencyColor(tier: FrequencyTier): string {
  if (tier === 'High Frequency') return '#FF453A';
  if (tier === 'Common') return '#FF9F0A';
  return '#FFD60A';
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

  const visibleCards =
    activeFilter === 'All Leaves'
      ? data.cards
      : data.cards.filter(c => c.frequency === activeFilter);

  // Original index needed so patches update the right card in data.cards
  const visibleWithIndex = visibleCards.map(card => ({
    card,
    originalIndex: data.cards.indexOf(card),
  }));

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
    setExpanded(new Set()); // collapse all when switching filters
  }

  return (
    <View style={s.container}>
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

      {/* Card list */}
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
              {/* Collapsed header */}
              <TouchableOpacity
                style={s.cardHeader}
                onPress={() => toggleCard(originalIndex)}
                activeOpacity={0.7}
              >
                <Text style={s.cardName}>{card.name}</Text>
                <View
                  style={[
                    s.freqDot,
                    { backgroundColor: frequencyColor(card.frequency) },
                  ]}
                />
                <Text style={[s.chevron, isOpen && s.chevronOpen]}>›</Text>
              </TouchableOpacity>

              {/* Expanded body */}
              {isOpen && (
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
              )}
            </View>
          );
        })}

        <View style={s.bottomSpacer} />
      </ScrollView>
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

  // Filter pill bar
  pillBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
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

  // Bottom spacer
  bottomSpacer: {
    height: 40,
  },
});
