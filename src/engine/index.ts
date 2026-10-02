// Public surface of the dog engine.

export * from './types';
export * from './constants';
export { computeDog } from './computeDog';
export { finalizeDay, newDayLedger, type FinalizeResult } from './finalizeDay';
export { dayKeyAt, dayWindow, walkCheckAt, type DayWindow } from './time';
export { baselineSteps, dailyTarget } from './targets';
export { greetingFor } from './greetings';
export { earnedTricks, lifeStageFor } from './growth';
export { isGoodDay } from './goodDay';
export { bondFromPoints } from './bond';
export { nudgeBudget } from './nudges';
