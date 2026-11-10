// v2 design tokens (Phase 28 WP0). One place for the v2 look so every screen
// pulls the same values. Source: docs/mBowl-DuoPlan.md → "v2 visual rules" and
// the CLAUDE.md design system. Font is the SF Pro system font — no fontFamily.
import type { TextStyle, ViewStyle } from 'react-native';

export const color = {
  bg: '#000000',
  surface: '#1C1C1E',
  card: '#2C2C2E',
  border: '#38383A',
  teal: '#00CEC9',
  tealTint: 'rgba(0, 206, 201, 0.12)',
  white: '#FFFFFF',
  dim: '#8E8E93',
  dimmer: '#48484A',
  green: '#30D158',
  orange: '#FF9F0A',
  yellow: '#FFD60A',
  bad: '#FF453A',
} as const;

// Digits that line up in columns (scores, averages, percentages).
const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

export const type = {
  /** Large page title — "Stats", "History", "New session". */
  title: { fontSize: 32, fontWeight: '600', color: color.white, letterSpacing: 0.2 },
  /** Sentence-case section header — "Striking", "Games". No tiny all-caps labels. */
  section: { fontSize: 20, fontWeight: '600', color: color.white },
  /** Hero number — the average, a final score. */
  hero: { fontSize: 56, fontWeight: '200', color: color.white, fontVariant: tabular, letterSpacing: -1 },
  /** Metric value in a 4-up row. Colored by its band when the sample allows. */
  metric: { fontSize: 22, fontWeight: '300', color: color.white, fontVariant: tabular },
  /** Plain value in a row (high game, a game score). */
  value: { fontSize: 17, fontWeight: '300', color: color.white, fontVariant: tabular },
  /** Row label / body text. */
  body: { fontSize: 17, fontWeight: '400', color: color.white },
  /** Secondary text under a value or row. */
  secondary: { fontSize: 13, fontWeight: '400', color: color.dim },
  /** Tappable text (Add game, season menu). */
  action: { fontSize: 17, fontWeight: '500', color: color.teal },
} satisfies Record<string, TextStyle>;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { card: 13, control: 10, capsule: 999 } as const;

/** Hairline divider between rows on black ("fewer boxes"). */
export const divider: ViewStyle = { height: 0.5, backgroundColor: color.border };

/** Boxed group — only for lists you tap into (History rows, the Log form). */
export const group: ViewStyle = { backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' };

/** Filled teal capsule — the main button (Done, Submit session). */
export const primaryButton: ViewStyle = {
  backgroundColor: color.teal,
  borderRadius: radius.capsule,
  minHeight: 50,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: space.xl,
};
export const primaryButtonText: TextStyle = { fontSize: 17, fontWeight: '600', color: '#000000' };
