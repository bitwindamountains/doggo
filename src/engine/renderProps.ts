// §11 DogState → renderer properties (Rive contract, ARCHITECTURE §7).

import { tailRightBias } from './bond';
import { RENDER_INDEX } from './constants';
import { localHours } from './time';
import type { DogProfile, DogState, RenderProps } from './types';

export function renderProps(
  state: DogState,
  dog: Pick<DogProfile, 'breed'>,
  nowMs: number,
  timezone: string,
  reduceMotion: boolean,
): RenderProps {
  return {
    breed: RENDER_INDEX.breed[dog.breed],
    lifeStage: RENDER_INDEX.lifeStage[state.lifeStage],
    energy: state.energy,
    contentment: state.contentment,
    bond: state.bond,
    pose: RENDER_INDEX.pose[state.pose],
    request: RENDER_INDEX.request[state.request],
    timeOfDay: localHours(nowMs, timezone),
    reduceMotion,
    tailRightBias: tailRightBias(state.bond),
  };
}
