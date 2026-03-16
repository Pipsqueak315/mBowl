import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Svg, { Rect, Line, Polygon, Text as SvgText } from 'react-native-svg';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PatternType = 'House' | 'Sport/PBA' | 'Regional';
type OilShape =
  | 'Heavy taper'
  | 'Moderate taper'
  | 'Slight taper'
  | 'Flat'
  | 'Flat / Reverse block';
type FilterPill = 'All' | PatternType;

interface StaticPattern {
  name: string;
  type: PatternType;
  length: string;
  lengthFt: number; // numeric for diagram calculation
  volume: string;
  shape: OilShape;
  defaultLine: string;
  defaultNotes: string;
}

interface PatternEntry {
  suggestedLine: string;
  notes: string;
}

export interface PatternsData {
  entries: PatternEntry[];
}

export interface PatternsTabProps {
  data: PatternsData;
  onUpdate: (updated: PatternsData) => void;
  onSave: () => void;
}

// ---------------------------------------------------------------------------
// Static pattern definitions (never stored — only suggestedLine + notes are)
// ---------------------------------------------------------------------------

const PATTERNS: StaticPattern[] = [
  {
    name: 'Standard House Shot',
    type: 'House',
    length: '43 ft',
    lengthFt: 43,
    volume: '~23–25 mL',
    shape: 'Heavy taper',
    defaultLine: 'Board 20, eyes 12',
    defaultNotes:
      "Let the wall do the work. Most misses are from over-thinking a pattern designed to funnel to the pocket.",
  },
  {
    name: 'Sport House / Flatter House',
    type: 'House',
    length: '40–42 ft',
    lengthFt: 41,
    volume: 'Medium-High',
    shape: 'Moderate taper',
    defaultLine: 'Board 18–20, eyes 11–12',
    defaultNotes:
      'Less wall to lean on — create angle yourself. More direct line than a standard house.',
  },
  {
    name: 'Cheetah',
    type: 'Sport/PBA',
    length: '33 ft',
    lengthFt: 33,
    volume: 'Low',
    shape: 'Flat',
    defaultLine: 'Board 15–17, eyes 10',
    defaultNotes:
      'Shortest and driest of the PBA Animals. Control game. Spare discipline critical. Rev-dominant players struggle.',
  },
  {
    name: 'Viper',
    type: 'Sport/PBA',
    length: '37 ft',
    lengthFt: 37,
    volume: 'Medium',
    shape: 'Moderate taper',
    defaultLine: 'Board 18–20, eyes 12',
    defaultNotes:
      'Most playable of the PBA Animals. Moderate challenge. Keep the ball in the oil longer.',
  },
  {
    name: 'Chameleon',
    type: 'Sport/PBA',
    length: '41 ft',
    lengthFt: 41,
    volume: 'Medium',
    shape: 'Moderate taper',
    defaultLine: 'Board 20, eyes 12–13',
    defaultNotes:
      'Plays long — need the ball downlane before it reads. Transition happens fast mid-block.',
  },
  {
    name: 'Scorpion',
    type: 'Sport/PBA',
    length: '42 ft',
    lengthFt: 42,
    volume: 'Medium-High',
    shape: 'Slight taper',
    defaultLine: 'Board 20–22, eyes 12',
    defaultNotes:
      'Straighter than you think. Strong equipment rolls out. Pearl or Phaze 5 territory.',
  },
  {
    name: 'Shark',
    type: 'Sport/PBA',
    length: '48 ft',
    lengthFt: 48,
    volume: 'Very High',
    shape: 'Slight taper',
    defaultLine: 'Board 22–25, eyes 13–14',
    defaultNotes:
      'Longest of the PBA Animals. Everything stays in the oil. VE Blackout or Physix #2 territory.',
  },
  {
    name: 'US Open',
    type: 'Sport/PBA',
    length: '52 ft',
    lengthFt: 52,
    volume: 'Very High',
    shape: 'Flat / Reverse block',
    defaultLine: 'Whatever works',
    defaultNotes:
      'Oil goes almost to the gutter. No wall, no forgiveness. Directional game required.',
  },
  {
    name: 'PBA Regional (Generic Sport)',
    type: 'Regional',
    length: '40–44 ft',
    lengthFt: 42,
    volume: 'Medium',
    shape: 'Slight taper',
    defaultLine: 'Board 18–20, eyes 12',
    defaultNotes:
      "Start conservative. Don't commit until 3–4 shots in. Adjust based on exit board.",
  },
];

export const DEFAULT_PATTERNS: PatternsData = {
  entries: PATTERNS.map(p => ({
    suggestedLine: p.defaultLine,
    notes: p.defaultNotes,
  })),
};

// ---------------------------------------------------------------------------
// Filter pills
// ---------------------------------------------------------------------------

const FILTER_PILLS: FilterPill[] = ['All', 'House', 'Sport/PBA', 'Regional'];

// ---------------------------------------------------------------------------
// Badge colors
// ---------------------------------------------------------------------------

function typeBadgeStyle(type: PatternType): { bg: string; text: string } {
  if (type === 'House') return { bg: '#00CEC9', text: '#000000' };
  if (type === 'Sport/PBA') return { bg: '#FF9F0A', text: '#000000' };
  return { bg: '#38383A', text: '#8E8E93' };
}

// ---------------------------------------------------------------------------
// Lane diagram — SVG (react-native-svg is already installed for chart-kit)
// ---------------------------------------------------------------------------

// ViewBox: 0 0 60 120
// Lane border: x=2 y=2 width=56 height=116
// Foul line: y=110  (8 units from bottom)
// Oil area above foul line: 108 units (y=2 to y=110)
// Max pattern: 52 ft fills full oil area
// Bottom oil trapezoid edge: x=5 to x=55 (90% of 56-unit lane width)

const SVG_W = 60;
const SVG_H = 120;
const FOUL_Y = 110;
const OIL_AREA_H = FOUL_Y - 2; // 108 units
const MAX_FT = 52;
const BOTTOM_X1 = 5;
const BOTTOM_X2 = 55;

function topXBounds(shape: OilShape): [number, number] {
  // Returns [left_x, right_x] for the top edge of the oil trapezoid
  const center = SVG_W / 2; // 30
  let halfWidth: number;
  switch (shape) {
    case 'Heavy taper':
      halfWidth = 56 * 0.20; // ~11
      break;
    case 'Moderate taper':
      halfWidth = 56 * 0.33; // ~18.5
      break;
    case 'Slight taper':
      halfWidth = 56 * 0.42; // ~23.5
      break;
    case 'Flat':
      halfWidth = 56 * 0.45; // ~25.2 — same as bottom
      break;
    case 'Flat / Reverse block':
      halfWidth = 56 * 0.47; // slightly wider at top
      break;
  }
  return [center - halfWidth, center + halfWidth];
}

function LaneDiagram({ lengthFt, shape }: { lengthFt: number; shape: OilShape }) {
  const oilHeight = (Math.min(lengthFt, MAX_FT) / MAX_FT) * OIL_AREA_H;
  const oilTopY = FOUL_Y - oilHeight;
  const [topLeft, topRight] = topXBounds(shape);

  const polyPoints = [
    `${BOTTOM_X1},${FOUL_Y}`,
    `${BOTTOM_X2},${FOUL_Y}`,
    `${topRight},${oilTopY}`,
    `${topLeft},${oilTopY}`,
  ].join(' ');

  return (
    <Svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
      {/* Lane border */}
      <Rect
        x={2}
        y={2}
        width={56}
        height={116}
        stroke="#38383A"
        strokeWidth={0.75}
        fill="transparent"
      />
      {/* Oil zone */}
      <Polygon points={polyPoints} fill="rgba(0, 206, 201, 0.22)" />
      {/* Oil zone outline (top edge only for clarity) */}
      <Line
        x1={topLeft}
        y1={oilTopY}
        x2={topRight}
        y2={oilTopY}
        stroke="#00CEC9"
        strokeWidth={0.75}
        opacity={0.5}
      />
      {/* Foul line */}
      <Line
        x1={2}
        y1={FOUL_Y}
        x2={58}
        y2={FOUL_Y}
        stroke="#FF453A"
        strokeWidth={0.75}
        opacity={0.7}
      />
      {/* Length label */}
      <SvgText
        x={SVG_W / 2}
        y={oilTopY - 3}
        textAnchor="middle"
        fontSize={7}
        fill="#8E8E93"
      >
        {lengthFt} ft
      </SvgText>
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PatternsTab({ data, onUpdate, onSave }: PatternsTabProps) {
  const [activeFilter, setActiveFilter] = useState<FilterPill>('All');

  const visible = PATTERNS.map((p, i) => ({ pattern: p, index: i })).filter(
    ({ pattern }) => activeFilter === 'All' || pattern.type === activeFilter,
  );

  function patchEntry(i: number, patch: Partial<PatternEntry>) {
    onUpdate({
      entries: data.entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
    });
  }

  return (
    <View style={s.container}>
      {/* Filter pill bar */}
      <View style={s.pillBar}>
        {FILTER_PILLS.map(pill => (
          <TouchableOpacity
            key={pill}
            style={[s.pill, activeFilter === pill && s.pillActive]}
            onPress={() => setActiveFilter(pill)}
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
        {visible.map(({ pattern, index }) => {
          const entry = data.entries[index] ?? {
            suggestedLine: pattern.defaultLine,
            notes: pattern.defaultNotes,
          };
          const badge = typeBadgeStyle(pattern.type);

          return (
            <View key={index} style={s.card}>
              {/* Lane diagram */}
              <View style={s.diagramContainer}>
                <LaneDiagram lengthFt={pattern.lengthFt} shape={pattern.shape} />
              </View>

              {/* Pattern name */}
              <Text style={s.patternName}>{pattern.name}</Text>

              {/* Metadata row */}
              <View style={s.metaRow}>
                <View style={[s.typeBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[s.typeBadgeText, { color: badge.text }]}>
                    {pattern.type}
                  </Text>
                </View>
                <Text style={s.metaText}>{pattern.length}</Text>
                <View style={s.metaDivider} />
                <Text style={s.metaText}>{pattern.volume}</Text>
              </View>

              <View style={s.separator} />

              {/* Suggested Line */}
              <View style={s.fieldBlock}>
                <Text style={s.fieldLabel}>SUGGESTED LINE</Text>
                <TextInput
                  style={s.fieldInput}
                  value={entry.suggestedLine}
                  onChangeText={v => patchEntry(index, { suggestedLine: v })}
                  onBlur={onSave}
                  returnKeyType="done"
                  placeholder="Starting position..."
                  placeholderTextColor="#48484A"
                />
              </View>

              {/* Notes */}
              <View style={[s.fieldBlock, s.lastFieldBlock]}>
                <Text style={s.fieldLabel}>NOTES</Text>
                <TextInput
                  style={s.notesInput}
                  value={entry.notes}
                  onChangeText={v => patchEntry(index, { notes: v })}
                  onBlur={onSave}
                  multiline
                  textAlignVertical="top"
                  placeholder="Pattern notes..."
                  placeholderTextColor="#48484A"
                />
              </View>
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
    fontSize: 12,
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
    padding: 16,
    marginBottom: 16,
  },

  // Lane diagram
  diagramContainer: {
    alignItems: 'center',
    marginBottom: 14,
  },

  // Pattern name
  patternName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
  },

  // Metadata row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  metaDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#38383A',
  },

  // Separator
  separator: {
    height: 0.5,
    backgroundColor: '#38383A',
    marginBottom: 14,
  },

  // Fields
  fieldBlock: {
    marginBottom: 12,
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
    color: '#00CEC9',
    padding: 0,
    minHeight: 20,
  },
  notesInput: {
    fontSize: 14,
    color: '#FFFFFF',
    padding: 0,
    minHeight: 40,
    lineHeight: 20,
  },

  // Bottom spacer
  bottomSpacer: {
    height: 40,
  },
});
