// The dog's room (PRD F2): a window whose sky and sun or moon follow the user's local time,
// a floor to stand on, and the water bowl beside the dog.

import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { ease } from '@/components/motion';
import { colors, roomColor } from '@/components/theme';

/** Sky colour by local hour: dawn, day, dusk, night. */
export function skyColor(hours: number): string {
  if (hours < 5 || hours >= 21) return '#1E2440';
  if (hours < 7) return '#F6B98E';
  if (hours < 17) return '#9FD3F2';
  if (hours < 19) return '#F4A261';
  return '#5A4E7C';
}

/** Sun (6–18 h) or moon position across the window, as fractions of its width and height. */
export function bodyInSky(hours: number): { sun: boolean; x: number; y: number } {
  const sun = hours >= 6 && hours < 18;
  const start = sun ? 6 : 18;
  const f = (((hours - start + 24) % 24) / 12) % 1; // 0 at rise, 1 at set
  return { sun, x: 0.1 + f * 0.8, y: 0.75 - Math.sin(f * Math.PI) * 0.55 };
}

interface Props {
  hours: number;
  asleep: boolean;
  reduceMotion: boolean;
  bowlLevel: number;
  bowlLabel: string;
  children: React.ReactNode; // the dog
}

export function Room({ hours, asleep, reduceMotion, bowlLevel, bowlLabel, children }: Props) {
  const body = bodyInSky(hours);
  return (
    <View style={styles.room}>
      <View
        style={styles.window}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Svg width="100%" height="100%" viewBox="0 0 100 70" preserveAspectRatio="none">
          <Rect x={0} y={0} width={100} height={70} fill={skyColor(hours)} />
          <Circle
            cx={body.x * 100}
            cy={body.y * 70}
            r={body.sun ? 9 : 7}
            fill={body.sun ? '#FFD166' : '#F1EEDD'}
          />
          <Rect x={48.5} y={0} width={3} height={70} fill={colors.card} />
          <Rect x={0} y={33.5} width={100} height={3} fill={colors.card} />
        </Svg>
      </View>
      <View
        style={[styles.floor, roomColor(hours, asleep) === colors.night && styles.floorNight]}
      />
      <View style={styles.scene}>
        {children}
        {asleep ? null : <Bowl level={bowlLevel} label={bowlLabel} reduceMotion={reduceMotion} />}
      </View>
    </View>
  );
}

/** The bowl fills and drains smoothly as water is logged and the day goes on. */
function Bowl({
  level,
  label,
  reduceMotion,
}: {
  level: number;
  label: string;
  reduceMotion: boolean;
}) {
  const [fill] = useState(() => new Animated.Value(level));
  useEffect(() => {
    if (reduceMotion) return fill.setValue(level);
    const anim = Animated.timing(fill, {
      toValue: level,
      duration: 700,
      easing: ease.out,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [fill, level, reduceMotion]);
  return (
    <View style={styles.bowl} accessible accessibilityLabel={label}>
      <Animated.View style={[styles.bowlFill, { transform: [{ scaleY: fill }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  room: { height: 300, marginHorizontal: -20, marginTop: -20, justifyContent: 'flex-end' },
  window: {
    position: 'absolute',
    top: 28,
    right: 28,
    width: 120,
    height: 84,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 6,
    borderColor: colors.card,
  },
  floor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
    backgroundColor: '#E9D3B3',
  },
  floorNight: { backgroundColor: '#3A3F5E' },
  scene: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: 18,
  },
  bowl: {
    width: 64,
    height: 26,
    marginLeft: -12,
    marginBottom: 8,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    backgroundColor: '#C9D7E8',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bowlFill: { height: '100%', backgroundColor: colors.water, transformOrigin: '50% 100%' },
});
