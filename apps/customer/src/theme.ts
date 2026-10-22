/**
 * BEVER colour system (customer app)
 *  primary   – mint emerald: brand, main actions, success
 *  secondary – saffron: highlights, progress, pending states, offers, badges
 *  deep      – forest: hero surfaces and strong headings
 *  neutrals  – mint-tinted whites and warm greys
 */
export const palette = {
  primary: '#059669', primaryDark: '#047857', primarySoft: '#ECFDF5', primaryLine: '#A7F3D0', primaryLight: '#6EE7B7',
  secondary: '#F59E0B', secondaryDark: '#B45309', secondarySoft: '#FFF7E6', secondaryLine: '#FDE68A',
  deep: '#064E3B',
  ink: '#1C1917', muted: '#78716C', faint: '#A8A29E', line: '#E7E5E4',
  bg: '#F3FBF7', surface: '#FFFFFF',
  danger: '#B91C1C', dangerSoft: '#FEE2E2',
} as const;
