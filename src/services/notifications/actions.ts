import type { NudgeType } from '@/engine';

/** Copy key of each nudge's one action button (PRD §7 rule 3). */
export const NUDGE_ACTION_COPY: Record<NudgeType, string> = {
  leash: 'push.action.leash',
  playBow: 'push.action.playBow',
  ball: 'push.action.ball',
  bored: 'push.action.ball',
  bedtime: 'push.action.bedtime',
};
