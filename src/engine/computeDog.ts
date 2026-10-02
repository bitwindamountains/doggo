// The engine's single entry point: stored data in, the dog's state and plans out.

import { energyAt } from './activityCurve';
import { activityPoints, bondFromPoints } from './bond';
import { CONTENTMENT, MINUTE_MS } from './constants';
import { contentmentFor, poseFor } from './contentment';
import { a11yKeyFor, lineKeyFor } from './copyKeys';
import { greetingFor } from './greetings';
import { lifeStageFor, newTricks } from './growth';
import { planNudges, shouldAskNudgeFrequency } from './nudges';
import { renderProps } from './renderProps';
import {
  activeRequests,
  bowlLevel,
  expectedWater,
  topRequest,
  type RequestContext,
} from './requests';
import { dailyTarget, isBaselineLearning } from './targets';
import { dayWindow, isAsleepAt, toMs, wakingFraction } from './time';
import type { DogState, EngineInput, EngineOutput, ScreenRung } from './types';
import { countableWalks, detectWalks, lastWalkEnd, stepsLastHour, sumSteps } from './walks';

export function computeDog(input: EngineInput): EngineOutput {
  const { prefs, dog, today, ledger } = input;
  const nowMs = toMs(input.now);
  const window = dayWindow(today.day, prefs);
  const isAsleep = isAsleepAt(nowMs, window);

  // Steps and walks
  const stepsToday = sumSteps(today.stepBuckets);
  const newWalks = prefs.stepsAvailable
    ? detectWalks(today.stepBuckets, window.start, nowMs, today.walks)
    : [];
  const walks = countableWalks([...today.walks, ...newWalks]);
  const lastWalkEndMs = lastWalkEnd(walks, nowMs);
  const stepTarget = dailyTarget(input.history);
  const baselineLearning = isBaselineLearning(dog, nowMs);

  // A walk after the screen-time rung fired counts as answering it (§6.3).
  const rungAnsweredByWalk =
    today.screenRungAt !== undefined &&
    lastWalkEndMs !== null &&
    lastWalkEndMs > toMs(today.screenRungAt);
  const screenAckRung: ScreenRung = rungAnsweredByWalk
    ? (Math.max(today.screenAckRung, today.screenRung) as ScreenRung)
    : today.screenAckRung;

  const ctx: RequestContext = {
    nowMs,
    window,
    prefs,
    stepBuckets: today.stepBuckets,
    stepsToday,
    stepsLast60: stepsLastHour(today.stepBuckets),
    stepTarget,
    lastWalkEndMs,
    lastPlayBowAtMs: input.lastPlayBowAt === undefined ? null : toMs(input.lastPlayBowAt),
    screenRung: today.screenRung,
    screenAckRung,
    water: today.water,
    waterLastAtMs: today.waterLastAt === undefined ? null : toMs(today.waterLastAt),
  };
  const requests = activeRequests(ctx);
  const request = topRequest(requests);

  const lifeStage = lifeStageFor(dog);
  const energy = energyAt(nowMs, window, lifeStage);
  const contentment = contentmentFor({
    activeRequests: requests,
    screenRung: today.screenRung,
    walkEndedWithin2h:
      lastWalkEndMs !== null && nowMs - lastWalkEndMs < CONTENTMENT.RECENT_WALK_MIN * MINUTE_MS,
    petsToday: today.petsToday,
    water: today.water,
    waterGoal: prefs.waterGoal,
    moodCheckedIn: today.moodToday !== undefined,
  });
  const greeting = greetingFor(input.lastOpenedAt, input.now, isAsleep);
  const bond = bondFromPoints(
    dog.bondPoints +
      activityPoints({
        walks: walks.length,
        pets: today.petsToday,
        moodCheckin: today.moodToday !== undefined,
      }),
  );

  const state: DogState = {
    pose: poseFor(isAsleep, request, energy),
    request,
    greeting,
    energy,
    contentment,
    bond,
    lifeStage,
    bowlLevel: isAsleep
      ? 1
      : bowlLevel(today.water, expectedWater(prefs.waterGoal, wakingFraction(nowMs, window))),
    isAsleep,
    baselineLearning,
  };

  return {
    state,
    render: renderProps(state, dog, nowMs, prefs.timezone, input.reduceMotion ?? false),
    lineKey: lineKeyFor({
      day: today.day,
      state,
      greeting,
      moodToday: today.moodToday,
      screenRung: today.screenRung,
    }),
    nudgePlan: planNudges({
      nowMs,
      window,
      prefs,
      ledger,
      baselineLearning,
      activeRequests: requests,
      stepsToday,
      stepTarget,
      lastWalkEndMs,
    }),
    unlockedTricks: newTricks(dog),
    a11yLabelKey: a11yKeyFor(state),
    activeRequests: requests,
    newWalks,
    stepsToday,
    stepTarget,
    askNudgeFrequency: shouldAskNudgeFrequency(ledger),
  };
}
