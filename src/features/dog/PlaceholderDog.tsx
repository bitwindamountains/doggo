// Stand-in renderer until the Rive file exists (ARCHITECTURE §7). Art: Microsoft Fluent
// Emoji 3D (MIT, assets/images/dog/LICENSE.md). Implements the same RenderProps:
// lifeStage → size, pose/request → posture and the prop beside the dog, energy → breathing
// pace, contentment → sway speed, bond → lean. Idle loops and reactions are skipped with
// reduce motion; the pose stays readable still.
// shortcut: one dog illustration for all four breeds; Rive (M8) brings the breeds.

import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';

import bedImg from '../../../assets/images/dog/bed.png';
import dogFaceImg from '../../../assets/images/dog/dog_face.png';
import dogImg from '../../../assets/images/dog/dog.png';
import dropletImg from '../../../assets/images/dog/droplet.png';
import guideDogImg from '../../../assets/images/dog/guide_dog.png';
import heartImg from '../../../assets/images/dog/red_heart.png';
import ballImg from '../../../assets/images/dog/softball.png';
import sparklesImg from '../../../assets/images/dog/sparkles.png';
import teddyImg from '../../../assets/images/dog/teddy_bear.png';
import zzzImg from '../../../assets/images/dog/zzz.png';
import { ease } from '@/components/motion';
import { colors } from '@/components/theme';
import { RENDER_INDEX, type RenderProps } from '@/engine';

const POSES = Object.keys(RENDER_INDEX.pose);
const REQUESTS = Object.keys(RENDER_INDEX.request);

export type DogTrigger = 'greetSmall' | 'greetBig' | 'pet' | 'drink' | 'headRest' | 'celebrate';

/** A one-shot reaction; a new object (or id) plays it again. */
export interface Trigger {
  name: DogTrigger;
  id: unknown;
}

interface Props {
  render: RenderProps;
  label: string; // screen-reader description of the dog's state
  hint?: string;
  /** From the user's own action (pet, drink). */
  reaction?: Trigger;
  /** From the engine's output (greeting, celebration). */
  event?: Trigger;
  onPress?(): void;
}

/** A looping 0 → 1 → 0 value, stopped on unmount or when `period` is 0. */
function useLoop(period: number) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!period) return v.setValue(0);
    const half = (to: number) =>
      Animated.timing(v, {
        toValue: to,
        duration: period / 2,
        easing: ease.soft,
        useNativeDriver: true,
      });
    const anim = Animated.loop(Animated.sequence([half(1), half(0)]));
    anim.start();
    return () => anim.stop();
  }, [v, period]);
  return v;
}

export function PlaceholderDog({ render, label, hint, reaction, event, onPress }: Props) {
  const pose = POSES[render.pose] ?? 'idle';
  const request = REQUESTS[render.request] ?? 'none';
  const asleep = pose === 'sleeping';
  const still = render.reduceMotion;
  const size = 150 * ([0.72, 0.86, 1, 1][render.lifeStage] ?? 1);
  const bedtime = request === 'bedtime' && !asleep;
  const bored = request === 'bored';

  // Breathing: slower asleep, quicker with energy (2.2–3.4 s awake, 4 s asleep).
  const breath = useLoop(still ? 0 : asleep ? 4000 : 3400 - render.energy * 12);
  // A happy dog sways (stands in for the tail wag); still when resting.
  const sway = useLoop(still || asleep || bored ? 0 : 1400 - render.contentment * 8);

  const [jump] = useState(() => new Animated.Value(0));
  useEffect(() => playJump(jump, reaction, still), [jump, reaction, still]);
  useEffect(() => playJump(jump, event, still), [jump, event, still]);

  // Posture: front down in a play bow, a droop when bored, a lean toward you with bond.
  const lean = request === 'playBow' ? -12 : bored ? 4 : -render.tailRightBias * 10;
  const amp = request === 'none' ? 2 : 4; // asking: a bigger, slower tilt

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      testID="dog"
      style={styles.wrap}
    >
      <View
        style={styles.stage}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {asleep ? <Image source={bedImg} style={styles.bed} /> : null}
        {bedtime ? <Image source={bedImg} style={styles.bedBeside} /> : null}
        {bored ? <Image source={teddyImg} style={styles.teddy} /> : null}
        {request === 'ball' ? <Image source={ballImg} style={styles.ball} /> : null}
        {asleep ? (
          // Asleep: the face on the pillow, eyes closed, breathing slowly.
          <Animated.View
            style={[
              styles.pillow,
              {
                transform: [
                  { scaleY: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) },
                ],
              },
            ]}
          >
            <SleepingFace size={84 * (size / 150)} />
          </Animated.View>
        ) : (
          <Animated.View
            style={{
              transform: [
                { translateY: jump },
                {
                  rotate: sway.interpolate({
                    inputRange: [0, 1],
                    outputRange: [`${lean - amp}deg`, `${lean + amp}deg`],
                  }),
                },
                { scaleY: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) },
              ],
              transformOrigin: '50% 100%',
            }}
          >
            <Image
              source={request === 'leash' ? guideDogImg : dogImg}
              style={{ width: size, height: size }}
            />
          </Animated.View>
        )}
        {asleep && !still ? <Zs /> : null}
        {asleep && still ? <Image source={zzzImg} style={[styles.zzz, { opacity: 1 }]} /> : null}
        {still ? null : <Burst trigger={reaction} />}
        {still ? null : <Burst trigger={event} />}
      </View>
      <Text
        style={[
          styles.tag,
          render.timeOfDay >= 22 || render.timeOfDay < 5 ? styles.tagNight : null,
        ]}
        importantForAccessibility="no"
        accessibilityElementsHidden
      >
        {request !== 'none' ? `${pose} · ${request}` : pose}
      </Text>
    </Pressable>
  );
}

function playJump(jump: Animated.Value, trigger: Trigger | undefined, still: boolean) {
  if (!trigger || still) return;
  const big = trigger.name === 'greetBig' || trigger.name === 'celebrate';
  const anim = Animated.sequence([
    Animated.timing(jump, {
      toValue: big ? -34 : -12,
      duration: big ? 260 : 160,
      easing: ease.out,
      useNativeDriver: true,
    }),
    Animated.timing(jump, {
      toValue: 0,
      duration: big ? 420 : 260,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }),
  ]);
  anim.start();
  return () => anim.stop();
}

// Eye centres in the 256 px face art and the fur colour around them.
const EYES = [104, 152];
const FUR = '#e8ac83';

/** The dog face art with its eyes closed (fur over the open eyes, a curved lash line). */
function SleepingFace({ size }: { size: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <Image source={dogFaceImg} style={{ width: size, height: size }} />
      <Svg width={size} height={size} viewBox="0 0 256 256" style={StyleSheet.absoluteFill}>
        {EYES.map((x) => (
          <Ellipse key={`f${x}`} cx={x} cy={106} rx={11} ry={16} fill={FUR} />
        ))}
        {EYES.map((x) => (
          <Path
            key={`l${x}`}
            d={`M${x - 10} 104 q10 9 20 0`}
            stroke="#3B2626"
            strokeWidth={5}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}

/** Zzz drifting up from the bed while asleep. */
function Zs() {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: 2800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [v]);
  return (
    <Animated.Image
      source={zzzImg}
      style={[
        styles.zzz,
        {
          opacity: v.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, -30] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.1] }) },
          ],
        },
      ]}
    />
  );
}

const BURSTS: Partial<Record<DogTrigger, ImageSourcePropType>> = {
  pet: heartImg,
  headRest: heartImg,
  drink: dropletImg,
  greetBig: sparklesImg,
  greetSmall: sparklesImg,
  celebrate: sparklesImg,
};

/** A burst of small pictures rising from the dog and fading; replays for each new trigger. */
function Burst({ trigger }: { trigger?: Trigger }) {
  const source = trigger ? BURSTS[trigger.name] : undefined;
  const [v] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!trigger) return;
    v.setValue(0);
    const anim = Animated.timing(v, {
      toValue: 1,
      duration: 1100,
      easing: ease.out,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [v, trigger]);
  if (!source || !trigger) return null;
  const count = trigger.name === 'celebrate' || trigger.name === 'greetBig' ? 6 : 3;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const dx = (i - (count - 1) / 2) * 26;
        return (
          <Animated.Image
            key={i}
            source={source}
            style={[
              styles.particle,
              {
                opacity: v.interpolate({
                  inputRange: [0, 0.15, 0.7, 1],
                  outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
                  {
                    translateY: v.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -70 - (i % 3) * 18],
                    }),
                  },
                  { scale: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1, 0.8] }) },
                ],
              },
            ]}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 24 },
  stage: { width: 220, height: 170, alignItems: 'center', justifyContent: 'flex-end' },
  bed: { position: 'absolute', bottom: -6, width: 200, height: 200 * 0.62, resizeMode: 'stretch' },
  // The dog faces left, so it walks toward its bed.
  bedBeside: {
    position: 'absolute',
    left: -34,
    bottom: -4,
    width: 120,
    height: 120 * 0.62,
    resizeMode: 'stretch',
  },
  pillow: { position: 'absolute', left: 32, bottom: 44 },
  teddy: { position: 'absolute', left: 6, bottom: 0, width: 54, height: 54 },
  ball: { position: 'absolute', left: 4, bottom: 0, width: 36, height: 36 },
  zzz: { position: 'absolute', left: 30, top: 18, width: 46, height: 46 },
  particle: { position: 'absolute', left: 96, top: 40, width: 28, height: 28 },
  tag: { fontSize: 12, color: colors.inkSoft, marginTop: 6 },
  tagNight: { color: colors.nightInk },
});
