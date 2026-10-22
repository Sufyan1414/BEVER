export const colors = {
  bg: '#F3FBF7',
  surface: '#FFFFFF',
  ink: '#1C1917',
  ink2: '#44403C',
  muted: '#78716C',
  faint: '#A8A29E',
  line: '#EEECE9',
  lineStrong: '#E7E5E4',
  brand: '#059669',
  brandDark: '#065F46',
  brandSoft: '#ECFDF5',
  brandLine: '#A7F3D0',
  success: '#047857',
  successSoft: '#ECFDF5',
  successLine: '#A7F3D0',
  danger: '#B91C1C',
  dangerSoft: '#FEF2F2',
  dangerLine: '#FCA5A5',
  info: '#1D4ED8',
  infoSoft: '#EFF6FF',
  infoLine: '#BFDBFE',
  overlay: 'rgba(28,25,23,0.45)',
} as const;

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const;

export const shadow = {
  card: {
    shadowColor: '#1C1917',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
} as const;
