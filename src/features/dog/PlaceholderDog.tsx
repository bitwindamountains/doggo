// Stand-in renderer until the Rive file exists (ARCHITECTURE §7). Implements the same
// RenderProps: breed → color, lifeStage → size, pose/request → shape and a text label,
// bond → tail bias. Triggers play a short bounce unless reduce motion is on.

import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';

import { RENDER_INDEX, type RenderProps } from '@/engine';

import { colors } from '@/components/theme';

const BREED_COLORS = ['#C68B59', '#D9822B', '#E3B76B', '#D98E4A'];
const POSES = Object.keys(RENDER_INDEX.pose);
const REQUESTS = Object.keys(RENDER_INDEX.request);
const PROPS: Record<string, string> = {
  leash: '🦮 leash',
  playBow: '🙇 play bow',
  ball: '🎾 ball',
  bored: '💤 sigh',
  water: '💧 bowl',
  bedtime: '🛏️ bed',
};

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

export function PlaceholderDog({ render, label, hint, reaction, event, onPress }: Props) {
  const [bounce] = useState(() => new Animated.Value(0));
  const pose = POSES[render.pose] ?? 'idle';
  const request = REQUESTS[render.request] ?? 'none';
  const asleep = pose === 'sleeping';
  const scale = [0.7, 0.85, 1, 1][render.lifeStage] ?? 1;
  const fur = BREED_COLORS[render.breed] ?? BREED_COLORS[0];
  const tailAngle = asleep ? 10 : -30 - render.tailRightBias * 100;

  const reduceMotion = render.reduceMotion;
  useEffect(() => play(bounce, reaction, reduceMotion), [reaction, reduceMotion, bounce]);
  useEffect(() => play(bounce, event, reduceMotion), [event, reduceMotion, bounce]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      testID="dog"
      style={styles.wrap}
    >
      <Animated.View style={{ transform: [{ translateY: bounce }, { scale }] }}>
        <Svg width={220} height={180} viewBox="0 0 220 180">
          {/* tail */}
          <Line
            x1={160}
            y1={110}
            x2={160 + 40 * Math.cos((tailAngle * Math.PI) / 180)}
            y2={110 + 40 * Math.sin((tailAngle * Math.PI) / 180)}
            stroke={fur}
            strokeWidth={10}
            strokeLinecap="round"
          />
          {/* body */}
          <Ellipse cx={120} cy={asleep ? 135 : 120} rx={55} ry={asleep ? 28 : 35} fill={fur} />
          {/* head */}
          <Circle cx={asleep ? 70 : 72} cy={asleep ? 125 : 80} r={32} fill={fur} />
          {/* ears */}
          <Path d={asleep ? 'M50 110 l-10 18 l20 -4z' : 'M50 60 l-8 -26 l24 12z'} fill={fur} />
          <Path d={asleep ? 'M84 104 l6 -16 l10 14z' : 'M88 52 l10 -24 l8 24z'} fill={fur} />
          {/* eyes: closed lines when asleep, inner-brow "asking" face on requests */}
          {asleep ? (
            <>
              <Line x1={56} y1={122} x2={66} y2={122} stroke={colors.ink} strokeWidth={3} />
              <Line x1={74} y1={122} x2={84} y2={122} stroke={colors.ink} strokeWidth={3} />
            </>
          ) : (
            <>
              <Circle cx={62} cy={78} r={4} fill={colors.ink} />
              <Circle cx={82} cy={78} r={4} fill={colors.ink} />
              {request !== 'none' ? (
                <>
                  <Line x1={56} y1={68} x2={64} y2={65} stroke={colors.ink} strokeWidth={2} />
                  <Line x1={88} y1={68} x2={80} y2={65} stroke={colors.ink} strokeWidth={2} />
                </>
              ) : null}
            </>
          )}
          {/* nose */}
          <Circle cx={asleep ? 44 : 50} cy={asleep ? 130 : 90} r={5} fill={colors.ink} />
        </Svg>
      </Animated.View>
      <View
        style={styles.tags}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Text style={styles.tag}>{pose}</Text>
        {request !== 'none' ? <Text style={styles.tag}>{PROPS[request]}</Text> : null}
      </View>
    </Pressable>
  );
}

function play(bounce: Animated.Value, trigger: Trigger | undefined, reduceMotion: boolean) {
  if (!trigger || reduceMotion) return;
  const height = trigger.name === 'greetBig' || trigger.name === 'celebrate' ? -24 : -10;
  Animated.sequence([
    Animated.timing(bounce, { toValue: height, duration: 160, useNativeDriver: true }),
    Animated.spring(bounce, { toValue: 0, useNativeDriver: true }),
  ]).start();
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 8 },
  tags: { flexDirection: 'row', gap: 6, marginTop: 4 },
  tag: {
    fontSize: 12,
    color: colors.inkSoft,
    backgroundColor: '#FFFFFFAA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
