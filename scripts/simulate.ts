// Prints a simulated dog day for a persona (DOG_ENGINE.md §12).
//   npm run simulate -- --persona=desk-worker [--days=3] [--all]
//   npm run simulate -- --persona=all

import { PERSONA_IDS, PERSONAS, type PersonaId } from '../src/engine/sim/personas';
import { formatTimeline, simulate } from '../src/engine/sim/simulate';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

const requested = arg('persona') ?? 'desk-worker';
const days = arg('days') ? Number(arg('days')) : undefined;
const all = process.argv.includes('--all');

const ids: PersonaId[] =
  requested === 'all'
    ? PERSONA_IDS
    : PERSONA_IDS.includes(requested as PersonaId)
      ? [requested as PersonaId]
      : [];

if (ids.length === 0) {
  console.error(`Unknown persona "${requested}". Choose one of: ${PERSONA_IDS.join(', ')}, all`);
  process.exit(1);
}

for (const id of ids) {
  console.log(formatTimeline(simulate(PERSONAS[id], { days }), { all }));
  console.log('');
}
