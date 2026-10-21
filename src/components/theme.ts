// Shared colors and room lighting.

export const colors = {
  cream: '#FFF7EC',
  ink: '#3B2A1A',
  inkSoft: '#6B5844',
  accent: '#E07A3F',
  accentInk: '#FFFFFF',
  card: '#FFFFFF',
  line: '#EADCC8',
  water: '#5AA9E6',
  night: '#2B2F4A',
  nightInk: '#E8E6F5',
};

/** Room wall color by local hour: morning warm, midday bright, evening amber, night dim. */
export function roomColor(hours: number, asleep: boolean): string {
  if (asleep || hours < 5 || hours >= 22) return colors.night;
  if (hours < 9) return '#FCE9D2';
  if (hours < 16) return colors.cream;
  if (hours < 19) return '#F9DDB8';
  return '#E9C9A0';
}
