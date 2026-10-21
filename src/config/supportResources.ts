// Support resources (PRD F9). Shipped as remote-config defaults; the remote copy can
// override them without an app update. verifyBeforeLaunch: a human must call each number
// and confirm it before release (MILESTONES M10).

export interface SupportResource {
  name: string;
  detail: string;
  phone?: string; // dialable, digits only
  sms?: { to: string; body: string };
  verifyBeforeLaunch: true;
}

export const SUPPORT_RESOURCES: Record<'PH' | 'US', SupportResource[]> = {
  PH: [
    {
      name: 'NCMH Crisis Hotline',
      detail: '1553 (landline, toll-free) · 0917 899 8727',
      phone: '1553',
      verifyBeforeLaunch: true,
    },
    {
      name: 'In Touch Crisis Line',
      detail: '+63 2 8893 7603',
      phone: '+63288937603',
      verifyBeforeLaunch: true,
    },
  ],
  US: [
    {
      name: '988 Suicide & Crisis Lifeline',
      detail: 'Call or text 988',
      phone: '988',
      verifyBeforeLaunch: true,
    },
    {
      name: 'Crisis Text Line',
      detail: 'Text HOME to 741741',
      sms: { to: '741741', body: 'HOME' },
      verifyBeforeLaunch: true,
    },
  ],
};

/** Philippine time zone → PH list; everything else → US list (the two launch markets). */
export function regionFor(timezone: string): 'PH' | 'US' {
  return timezone === 'Asia/Manila' ? 'PH' : 'US';
}
