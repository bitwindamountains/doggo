// Stand-in renderer until the Rive file exists (ARCHITECTURE §7). Implements the same
// RenderProps: breed → coat and ears, lifeStage → size, pose/request → posture and the prop
// it holds, energy → breathing pace, contentment → tail speed, bond → tail bias.
// Idle loops and reactions are skipped with reduce motion; the pose stays readable still.

import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

import { ease } from '@/components/motion';
import { colors } from '@/components/theme';
import { RENDER_INDEX, type RenderProps } from '@/engine';

const POSES = Object.keys(RENDER_INDEX.pose);
const REQUESTS = Object.keys(RENDER_INDEX.request);

/** Coat, darker accent and ear style per breed (aspin, shiba, golden, corgi). */
const BREEDS = [
  { coat: '#C68B59', dark: '#8E5B34', ears: 'tipped', legs: 22 },
  { coat: '#D9822B', dark: '#F4E3CC', ears: 'pointed', legs: 22 },
  { coat: '#E3B76B', dark: '#B9884A', ears: 'floppy', legs: 24 },
  { coat: '#D98E4A', dark: '#FFF3E2', ears: 'big', legs: 12 },
] as const;

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
  const breed = BREEDS[render.breed] ?? BREEDS[0];
  const size = [0.72, 0.86, 1, 1][render.lifeStage] ?? 1;
  const lying = asleep || request === 'bored' || request === 'bedtime';

  // Breathing: slower asleep, quicker with energy (2.2–3.4 s awake, 4 s asleep).
  const breath = useLoop(still ? 0 : asleep ? 4000 : 3400 - render.energy * 12);
  // Tail: still when lying down; a happier dog wags faster (0.5–1.3 s).
  const wag = useLoop(still || lying ? 0 : 1300 - render.contentment * 8);
  // Asking: a slow head tilt while a request is open.
  const tilt = useLoop(still || request === 'none' || lying ? 0 : 2600);

  const [jump] = useState(() => new Animated.Value(0));
  useEffect(() => playJump(jump, reaction, still), [jump, reaction, still]);
  useEffect(() => playJump(jump, event, still), [jump, event, still]);

  // Lying down the tail rests along the floor; standing, bond biases it up and right.
  const tailRest = lying ? 12 : -40 - render.tailRightBias * 60;
  const tailRotate = wag.interpolate({
    inputRange: [0, 1],
    outputRange: [`${tailRest - 18}deg`, `${tailRest + 18}deg`],
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      testID="dog"
      style={styles.wrap}
    >
      <Animated.View
        style={{
          transform: [
            { translateY: jump },
            { scale: size },
            { rotate: tilt.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) },
          ],
        }}
      >
        <View
          style={styles.stage}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {lying ? <Bed /> : null}
          {/* tail pivots at its base, behind the body */}
          <Animated.View
            style={[
              styles.tail,
              lying && styles.tailLying,
              { transform: [{ rotate: tailRotate }] },
            ]}
          >
            <Svg width={60} height={14}>
              <Rect x={0} y={2} width={52} height={10} rx={5} fill={breed.coat} />
            </Svg>
          </Animated.View>
          <Animated.View
            style={{
              transform: [
                { scaleY: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
              ],
            }}
          >
            <Body breed={breed} lying={lying} asleep={asleep} request={request} />
          </Animated.View>
          {asleep && !still ? <Zs /> : null}
          {still ? null : <Burst trigger={reaction} />}
          {still ? null : <Burst trigger={event} />}
        </View>
      </Animated.View>
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

type Breed = (typeof BREEDS)[number];

function Body({
  breed,
  lying,
  asleep,
  request,
}: {
  breed: Breed;
  lying: boolean;
  asleep: boolean;
  request: string;
}) {
  const bow = request === 'playBow';
  const headX = lying ? 64 : 70;
  const headY = lying ? 120 : bow ? 96 : 78;
  return (
    <Svg width={220} height={170} viewBox="0 0 220 170">
      {/* legs (short for the corgi), hidden when lying down */}
      {!lying
        ? [86, 104, 136, 154].map((x, i) => (
            <Rect
              key={x}
              x={x}
              y={bow && i < 2 ? 128 : 124}
              width={12}
              height={breed.legs + (bow && i < 2 ? -6 : 0)}
              rx={6}
              fill={breed.coat}
            />
          ))
        : null}
      {/* body: rear up in a play bow, long and low when lying */}
      <G transform={bow ? 'rotate(-12 120 112)' : undefined}>
        <Ellipse
          cx={122}
          cy={lying ? 132 : 112}
          rx={lying ? 60 : 52}
          ry={lying ? 26 : 32}
          fill={breed.coat}
        />
        <Ellipse
          cx={108}
          cy={lying ? 138 : 122}
          rx={26}
          ry={lying ? 12 : 16}
          fill={breed.dark}
          opacity={0.55}
        />
      </G>
      {/* head */}
      <Circle cx={headX} cy={headY} r={30} fill={breed.coat} />
      <Ellipse cx={headX - 14} cy={headY + 10} rx={16} ry={12} fill={breed.dark} opacity={0.55} />
      <Ears breed={breed} x={headX} y={headY} lying={lying} />
      {/* eyes: closed when asleep; inner-brow raise is the "asking" face */}
      {asleep ? (
        <>
          <Path
            d={`M${headX - 18} ${headY - 2} q5 4 10 0`}
            stroke={colors.ink}
            strokeWidth={2.5}
            fill="none"
          />
          <Path
            d={`M${headX + 2} ${headY - 2} q5 4 10 0`}
            stroke={colors.ink}
            strokeWidth={2.5}
            fill="none"
          />
        </>
      ) : (
        <>
          <Circle cx={headX - 12} cy={headY - 4} r={4} fill={colors.ink} />
          <Circle cx={headX + 8} cy={headY - 4} r={4} fill={colors.ink} />
          <Circle cx={headX - 11} cy={headY - 5.5} r={1.3} fill="#FFFFFF" />
          <Circle cx={headX + 9} cy={headY - 5.5} r={1.3} fill="#FFFFFF" />
          {request !== 'none' && !lying ? (
            <>
              <Line
                x1={headX - 18}
                y1={headY - 14}
                x2={headX - 9}
                y2={headY - 17}
                stroke={colors.ink}
                strokeWidth={2}
              />
              <Line
                x1={headX + 14}
                y1={headY - 14}
                x2={headX + 5}
                y2={headY - 17}
                stroke={colors.ink}
                strokeWidth={2}
              />
            </>
          ) : null}
        </>
      )}
      <Ellipse cx={headX - 24} cy={headY + 6} rx={5} ry={4} fill={colors.ink} />
      <Prop request={request} x={headX} y={headY} />
    </Svg>
  );
}

function Ears({ breed, x, y, lying }: { breed: Breed; x: number; y: number; lying: boolean }) {
  const fill = breed.ears === 'tipped' ? breed.dark : breed.coat;
  if (breed.ears === 'floppy' || lying) {
    return (
      <>
        <Ellipse cx={x - 22} cy={y + 4} rx={9} ry={18} fill={breed.dark} />
        <Ellipse cx={x + 20} cy={y + 4} rx={9} ry={18} fill={breed.dark} />
      </>
    );
  }
  const h = breed.ears === 'big' ? 34 : 26;
  const w = breed.ears === 'big' ? 14 : 11;
  return (
    <>
      <Path d={`M${x - 26} ${y - 10} l${w / 2} -${h} l${w} ${h - 6}z`} fill={fill} />
      <Path d={`M${x + 4} ${y - 16} l${w / 2} -${h} l${w} ${h + 2}z`} fill={fill} />
    </>
  );
}

/** What the dog brings or shows for its request (drawn, not emoji). */
function Prop({ request, x, y }: { request: string; x: number; y: number }) {
  switch (request) {
    case 'leash':
      return (
        <>
          <Path
            d={`M${x - 22} ${y + 14} C ${x - 40} ${y + 50}, ${x - 10} ${y + 70}, ${x - 36} ${y + 84}`}
            stroke={colors.accent}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
          />
          <Ellipse
            cx={x - 42}
            cy={y + 90}
            rx={9}
            ry={6}
            stroke={colors.accent}
            strokeWidth={4}
            fill="none"
          />
        </>
      );
    case 'ball':
      return (
        <>
          <Circle cx={x - 34} cy={150} r={11} fill="#C9D93A" />
          <Path d={`M${x - 44} 146 q10 8 20 0`} stroke="#FFFFFF" strokeWidth={2} fill="none" />
        </>
      );
    case 'bored':
      // a sigh: three short puffs from the nose
      return (
        <>
          {[0, 1, 2].map((i) => (
            <Circle
              key={i}
              cx={x - 36 - i * 9}
              cy={y + 2 - i * 5}
              r={3 - i * 0.6}
              fill={colors.inkSoft}
              opacity={0.5}
            />
          ))}
        </>
      );
    default:
      return null;
  }
}

function Bed() {
  return (
    <Svg width={220} height={170} viewBox="0 0 220 170" style={StyleSheet.absoluteFill}>
      <Rect x={28} y={128} width={170} height={34} rx={17} fill="#8FA8C8" />
      <Rect x={40} y={136} width={146} height={20} rx={10} fill="#B9CBE2" />
    </Svg>
  );
}

/** Three z's drifting up while asleep. */
function Zs() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <Drift
          key={i}
          delay={i * 900}
          style={[styles.z, { left: 30 + i * 10, fontSize: 14 + i * 4 }]}
        >
          z
        </Drift>
      ))}
    </>
  );
}

function Drift({
  delay,
  style,
  children,
}: {
  delay: number;
  style: object;
  children: React.ReactNode;
}) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, {
          toValue: 1,
          duration: 2700,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [v, delay]);
  return (
    <Animated.Text
      style={[
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }) }],
        },
      ]}
    >
      {children}
    </Animated.Text>
  );
}

const BURSTS: Partial<Record<DogTrigger, { color: string; shape: 'heart' | 'drop' | 'spark' }>> = {
  pet: { color: '#E8637A', shape: 'heart' },
  headRest: { color: '#E8637A', shape: 'heart' },
  drink: { color: colors.water, shape: 'drop' },
  greetBig: { color: colors.accent, shape: 'spark' },
  greetSmall: { color: colors.accent, shape: 'spark' },
  celebrate: { color: '#F2B705', shape: 'spark' },
};

/** A burst of small shapes rising from the dog and fading; replays for each new trigger. */
function Burst({ trigger }: { trigger?: Trigger }) {
  const spec = trigger ? BURSTS[trigger.name] : undefined;
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
  if (!spec || !trigger) return null;
  const kind = trigger.name;
  const count = kind === 'celebrate' || kind === 'greetBig' ? 7 : 4;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const dx = (i - (count - 1) / 2) * 22;
        return (
          <Animated.View
            key={i}
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
          >
            <Svg width={16} height={16} viewBox="0 0 16 16">
              {spec.shape === 'heart' ? (
                <Path d="M8 14 L2 8 A3.2 3.2 0 0 1 8 4 A3.2 3.2 0 0 1 14 8 Z" fill={spec.color} />
              ) : spec.shape === 'drop' ? (
                <Path
                  d="M8 1 C 11 6, 13 9, 13 11 A5 5 0 0 1 3 11 C 3 9, 5 6, 8 1 Z"
                  fill={spec.color}
                />
              ) : (
                <Path
                  d="M8 0 L9.8 6.2 L16 8 L9.8 9.8 L8 16 L6.2 9.8 L0 8 L6.2 6.2 Z"
                  fill={spec.color}
                />
              )}
            </Svg>
          </Animated.View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 24 },
  stage: { width: 220, height: 170 },
  tail: {
    position: 'absolute',
    left: 168,
    top: 96,
    width: 60,
    height: 14,
    transformOrigin: '0% 50%',
  },
  tailLying: { left: 174, top: 128 },
  z: { position: 'absolute', top: 70, color: colors.nightInk, fontWeight: '700' },
  particle: { position: 'absolute', left: 102, top: 60 },
  tag: { fontSize: 12, color: colors.inkSoft, marginTop: 6 },
  tagNight: { color: colors.nightInk },
});
