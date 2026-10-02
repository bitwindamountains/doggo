// Copy rules (docs/PRD.md §7) and copy ↔ engine key contract (docs/DOG_ENGINE.md §10).

import { LINE_VARIANTS, PUSH_VARIANTS, RENDER_INDEX } from '@/engine';

import { en } from './en';
import { t } from './index';

const BANNED: { label: string; pattern: RegExp }[] = [
  { label: 'sad', pattern: /\bsad(ly|ness)?\b/i },
  { label: 'disappointed', pattern: /\bdisappoint/i },
  { label: 'failed', pattern: /\bfail/i },
  { label: 'broke', pattern: /\bbrok(e|en)\b/i },
  { label: 'streak', pattern: /\bstreak/i },
  { label: 'wasted', pattern: /\bwast(e|ed|ing)\b/i },
  { label: 'lazy', pattern: /\blaz(y|iness)\b/i },
  { label: 'guilty', pattern: /\bguilt/i },
  { label: 'ashamed', pattern: /\bashamed|\bshame/i },
  { label: 'starving', pattern: /\bstarv/i },
  { label: 'sick', pattern: /\bsick/i },
  { label: 'dying', pattern: /\bdy(ing|e|ed)\b|\bdead\b|\bdeath\b/i },
  { label: 'abandoned', pattern: /\babandon/i },
  { label: 'you only', pattern: /\byou only\b/i },
  { label: "you didn't", pattern: /\byou (didn['’]t|did not|never)\b/i },
  { label: 'missed', pattern: /\bmiss(ed)?\b/i },
  { label: 'calories', pattern: /\bcalori/i },
  { label: 'weight', pattern: /\bweigh/i },
];

const LONGEST_NAME = 'X'.repeat(24);

describe('copy rules (PRD §7)', () => {
  it.each(Object.entries(en))('%s avoids banned words', (_key, text) => {
    const hits = BANNED.filter(({ pattern }) => pattern.test(text)).map((b) => b.label);
    expect(hits).toEqual([]);
  });

  it('notification bodies stay within 60 characters with a 24-character name', () => {
    const tooLong = Object.keys(en)
      .filter((k) => k.startsWith('push.') && !k.startsWith('push.action.'))
      .map((k) => t(k, { name: LONGEST_NAME }))
      .filter((text) => text.length > 60);
    expect(tooLong).toEqual([]);
  });
});

describe('copy keys match the engine (DOG_ENGINE §10)', () => {
  it.each(Object.entries(LINE_VARIANTS))('line base %s has exactly %i variants', (base, count) => {
    const keys = Object.keys(en).filter((k) => k.startsWith(`${base}.`));
    expect(keys.sort()).toEqual(Array.from({ length: count }, (_, i) => `${base}.${i}`));
  });

  it.each(Object.entries(PUSH_VARIANTS))('push %s has exactly %i variants', (type, count) => {
    const keys = Object.keys(en).filter((k) => new RegExp(`^push\\.${type}\\.\\d+$`).test(k));
    expect(keys.sort()).toEqual(Array.from({ length: count }, (_, i) => `push.${type}.${i}`));
  });

  it('has a screen-reader label for every request and pose', () => {
    const states = [
      ...Object.keys(RENDER_INDEX.request).filter((r) => r !== 'none'),
      ...Object.keys(RENDER_INDEX.pose),
    ];
    for (const state of states) expect(en).toHaveProperty([`a11y.${state}`]);
  });
});

describe('t()', () => {
  it('fills placeholders and leaves unknown ones', () => {
    expect(t('leash.0', { name: 'Biscuit' })).toBe('Biscuit brought you the leash.');
    expect(t('leash.0')).toBe('{name} brought you the leash.');
  });

  it('throws on a missing key', () => {
    expect(() => t('nope.0')).toThrow('Missing copy key');
  });
});
