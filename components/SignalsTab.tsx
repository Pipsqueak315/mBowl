import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  UIManager,
} from 'react-native';
import { animateNextLayout } from '@/src/v2/motion';
import SegmentedControl from '@/components/v2/SegmentedControl';
import { SWITCH_GUIDE_V2, LANE_READS_V2 } from '@/src/referenceContent';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Reference trim (Nov 15, scope locked Nov 11 -- Marcus: "let me decide which
// ball on the fly"): the Ball Arsenal view and the Switch Guide's "Switch to"
// field are gone from the screen. Their data (arsenal[], switchGuide[].switchTo)
// stays in SignalsData and round-trips on every save -- REFERENCE has no shadow
// key, so dropping fields would erase them. Hidden, not deleted.
type SignalsView = 'Switch Guide' | 'Lane Reads';

interface SwitchGuideRow {
  whatYoureSeeing: string;
  cause: string;
  switchTo: string;
  feet: string;
  direction: string;
}

interface ArsenalBall {
  name: string;
  strength: number;
  motionProfile: string;
  whenToUse: string;
}

interface LaneRead {
  whatYoureSeeing: string;
  whatItMeans: string;
  recommendation: string;
}

export interface SignalsData {
  switchGuide: SwitchGuideRow[];
  arsenal: ArsenalBall[];
  laneReads: LaneRead[];
}

export interface SignalsTabProps {
  data: SignalsData;
  onUpdate: (updated: SignalsData) => void;
  onSave: () => void;
}

// ---------------------------------------------------------------------------
// Default data
// ---------------------------------------------------------------------------

export const DEFAULT_SIGNALS: SignalsData = {
  // Phase 30B (Nov 24): right-handed, ball-free, short -- src/referenceContent.ts.
  // The v1 text is in src/referenceUpgrade.ts (upgrades an unedited stored copy).
  switchGuide: SWITCH_GUIDE_V2,
  arsenal: [
    {
      name: 'Spare Ball',
      strength: 1,
      motionProfile: 'Dead straight. No read, no hook.',
      whenToUse: 'Single pins only. Never on strikes.',
    },
    {
      name: 'Phaze 2 Pearl',
      strength: 2,
      motionProfile:
        'Very clean frontend, sharp angular snap on the backend. High RG, stores energy long.',
      whenToUse:
        'Fresh clean conditions. When you need length and a defined move at the break.',
    },
    {
      name: 'Phaze 5',
      strength: 2,
      motionProfile:
        'Extremely long and clean through the front. Snappier backend than the Pearl with the polish. Longest ball in the bag.',
      whenToUse:
        'When the Pearl is reading too early or when you need maximum length before the snap.',
    },
    {
      name: 'Physix Blackout #1',
      strength: 3,
      motionProfile:
        'Arcy, controlled, smooth midlane read. Less angular than the Pearl. Consistent and predictable.',
      whenToUse:
        'Game 1 on a fresh house shot when you want a controlled arc. Currently benched — revisit when the house shot tightens.',
    },
    {
      name: 'Summit',
      strength: 3,
      motionProfile:
        'Hybrid. Earlier midlane read than the Pearl. Smooth but strong, continuous. Less angular, more roll-through.',
      whenToUse:
        "When the Pearl starts losing shape but you're not in transition yet. Good benchmark ball.",
    },
    {
      name: 'Phaze 2 Solid',
      strength: 3,
      motionProfile:
        'More surface than the Pearl. Earlier traction through the heads. Consistent arc into the pocket.',
      whenToUse:
        'When the Pearl starts skating. Reliable when you need more hook without stepping way up in strength.',
    },
    {
      name: 'Physix Blackout #2 (Pin Down)',
      strength: 4,
      motionProfile:
        'Pin down layout creates an earlier, smoother, more controlled roll. Strong but not aggressive. Built for volume and distance.',
      whenToUse:
        "Longer oil patterns on fresh conditions. When the pattern has length and you need a ball that rolls through it instead of snapping at it.",
    },
    {
      name: 'Primal Rage Evolution',
      strength: 4,
      motionProfile:
        'Symmetrical pearl. Very clean frontend, then explosive angular snap at the break. High RG — stores energy, then fires.',
      whenToUse:
        'Mid-block transition. When the VE Blackout is reading too early and rolling out. Step down in strength, up in length and snap.',
    },
    {
      name: 'VE Blackout',
      strength: 5,
      motionProfile:
        'Strong, angular, high flare asymmetric. Clean through the heads then big midlane-to-backend move. Your weekly workhorse.',
      whenToUse:
        'Heavy oil and mid-transition on the house shot. The ball you live in for most of league night. When the Solid and Summit give up, this takes over.',
    },
  ],
  laneReads: LANE_READS_V2,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function directionColor(dir: string): string {
  if (dir.startsWith('🟢')) return '#30D158';
  if (dir.startsWith('🔴')) return '#FF453A';
  return '#FFD60A';
}

// Phase 30B: the view toggle is the shared SegmentedControl (was teal pills).
const VIEWS = [
  { key: 'Switch Guide', label: 'Switch Guide' },
  { key: 'Lane Reads', label: 'Lane Reads' },
] as const satisfies readonly { key: SignalsView; label: string }[];

export default function SignalsTab({ data, onUpdate, onSave }: SignalsTabProps) {
  const [view, setView] = useState<SignalsView>('Switch Guide');
  const [expandedGuide, setExpandedGuide] = useState<Set<number>>(new Set());
  const [expandedLane, setExpandedLane] = useState<Set<number>>(new Set());

  // ---- Toggle helpers ----

  type SetUpdater = (updater: (prev: Set<number>) => Set<number>) => void;

  function toggle(setter: SetUpdater, i: number) {
    animateNextLayout();
    setter(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  // ---- Update helpers ----

  function patchGuide(i: number, patch: Partial<SwitchGuideRow>) {
    onUpdate({
      ...data,
      switchGuide: data.switchGuide.map((row, idx) =>
        idx === i ? { ...row, ...patch } : row,
      ),
    });
  }

  function patchLane(i: number, patch: Partial<LaneRead>) {
    onUpdate({
      ...data,
      laneReads: data.laneReads.map((read, idx) =>
        idx === i ? { ...read, ...patch } : read,
      ),
    });
  }

  // ---- Switch Guide ----

  function renderSwitchGuide() {
    return (
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        {data.switchGuide.map((row, i) => {
          const isOpen = expandedGuide.has(i);
          return (
            <View key={i} style={s.card}>
              <TouchableOpacity
                style={s.cardHeader}
                onPress={() => toggle(setExpandedGuide, i)}
                activeOpacity={0.7}
              >
                <View style={s.badgeOutline}>
                  <Text style={s.badgeOutlineText}>{i + 1}</Text>
                </View>
                <Text style={s.cardHeaderText} numberOfLines={isOpen ? 0 : 2}>
                  {row.whatYoureSeeing}
                </Text>
                <Text
                  style={[s.directionLabel, { color: directionColor(row.direction) }]}
                  numberOfLines={1}
                >
                  {row.direction}
                </Text>
                <Text style={[s.chevron, isOpen && s.chevronOpen]}>›</Text>
              </TouchableOpacity>

              {isOpen && (
                <View style={s.expandedBody}>
                  <View style={s.separator} />

                  <View style={s.fieldBlock}>
                    <Text style={s.fieldLabel}>WHAT YOU'RE SEEING</Text>
                    <TextInput
                      style={s.fieldInput}
                      value={row.whatYoureSeeing}
                      onChangeText={v => patchGuide(i, { whatYoureSeeing: v })}
                      onBlur={onSave}
                      multiline
                      textAlignVertical="top"
                      placeholder="Describe the reaction..."
                      placeholderTextColor="#48484A"
                    />
                  </View>

                  <View style={s.fieldBlock}>
                    <Text style={s.fieldLabel}>CAUSE</Text>
                    <TextInput
                      style={s.fieldInput}
                      value={row.cause}
                      onChangeText={v => patchGuide(i, { cause: v })}
                      onBlur={onSave}
                      multiline
                      textAlignVertical="top"
                      placeholder="Why is this happening..."
                      placeholderTextColor="#48484A"
                    />
                  </View>

                  <View style={s.fieldBlock}>
                    <Text style={s.fieldLabel}>FEET ADJUSTMENT</Text>
                    <TextInput
                      style={s.fieldInput}
                      value={row.feet}
                      onChangeText={v => patchGuide(i, { feet: v })}
                      onBlur={onSave}
                      multiline
                      textAlignVertical="top"
                      placeholder="Foot position..."
                      placeholderTextColor="#48484A"
                    />
                  </View>

                  <View style={[s.fieldBlock, s.lastFieldBlock]}>
                    <Text style={s.fieldLabel}>DIRECTION</Text>
                    <TextInput
                      style={s.fieldInput}
                      value={row.direction}
                      onChangeText={v => patchGuide(i, { direction: v })}
                      onBlur={onSave}
                      returnKeyType="done"
                      placeholder="🟢 Down / 🔴 Up / 🟡 Feet only"
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
    );
  }

  // ---- Lane Reads ----

  function renderLaneReads() {
    return (
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        {data.laneReads.map((read, i) => {
          const isOpen = expandedLane.has(i);
          return (
            <View key={i} style={s.card}>
              <TouchableOpacity
                style={s.cardHeader}
                onPress={() => toggle(setExpandedLane, i)}
                activeOpacity={0.7}
              >
                <Text style={s.cardHeaderText} numberOfLines={isOpen ? 0 : 2}>
                  {read.whatYoureSeeing}
                </Text>
                <Text style={[s.chevron, isOpen && s.chevronOpen]}>›</Text>
              </TouchableOpacity>

              {isOpen && (
                <View style={s.expandedBody}>
                  <View style={s.separator} />

                  <View style={s.fieldBlock}>
                    <Text style={s.fieldLabel}>WHAT YOU'RE SEEING</Text>
                    <TextInput
                      style={s.fieldInput}
                      value={read.whatYoureSeeing}
                      onChangeText={v => patchLane(i, { whatYoureSeeing: v })}
                      onBlur={onSave}
                      multiline
                      textAlignVertical="top"
                      placeholder="Describe the reaction..."
                      placeholderTextColor="#48484A"
                    />
                  </View>

                  <View style={s.fieldBlock}>
                    <Text style={s.fieldLabel}>WHAT IT MEANS</Text>
                    <TextInput
                      style={s.fieldInput}
                      value={read.whatItMeans}
                      onChangeText={v => patchLane(i, { whatItMeans: v })}
                      onBlur={onSave}
                      multiline
                      textAlignVertical="top"
                      placeholder="Interpretation..."
                      placeholderTextColor="#48484A"
                    />
                  </View>

                  <View style={[s.fieldBlock, s.lastFieldBlock]}>
                    <Text style={s.fieldLabel}>RECOMMENDATION</Text>
                    <TextInput
                      style={s.fieldInput}
                      value={read.recommendation}
                      onChangeText={v => patchLane(i, { recommendation: v })}
                      onBlur={onSave}
                      multiline
                      textAlignVertical="top"
                      placeholder="What to do..."
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
    );
  }

  // ---- Render ----

  return (
    <View style={s.container}>
      {/* View toggle */}
      <View style={s.toggleRow}>
        <SegmentedControl
          segments={VIEWS}
          value={view}
          onChange={setView}
          accessibilityLabel="Signals view"
        />
      </View>

      {view === 'Switch Guide' && renderSwitchGuide()}
      {view === 'Lane Reads' && renderLaneReads()}
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

  // Toggle
  toggleRow: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  togglePill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
  },
  togglePillActive: {
    backgroundColor: '#00CEC9',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
  },
  toggleTextActive: {
    color: '#000000',
    fontWeight: '600',
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

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E8E93',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },

  // Card
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 13,
    paddingHorizontal: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },

  // Card header (collapsed row)
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  cardHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  directionLabel: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 0,
    maxWidth: 90,
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

  // Number badge (outline, Switch Guide)
  badgeOutline: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#00CEC9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeOutlineText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#00CEC9',
  },

  // Expanded content
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
    fontWeight: '500',
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

  // Strength dots
  dotRow: { flexDirection: 'row', gap: 3, alignItems: 'center', flexShrink: 0 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
});
