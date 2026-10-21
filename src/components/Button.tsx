import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

import { useApp } from './AppProvider';

import { ease, t } from './motion';
import { colors } from './theme';

interface Props {
  label: string;
  onPress(): void;
  kind?: 'primary' | 'secondary';
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function Button({ label, onPress, kind = 'primary', disabled, accessibilityLabel }: Props) {
  const primary = kind === 'primary';
  const [scale] = useState(() => new Animated.Value(1));
  // Press feedback: a quick give under the finger (skipped with reduce motion).
  const { reduceMotion } = useApp();
  const running = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => () => running.current?.stop(), []);
  const press = (to: number) => {
    if (reduceMotion) return;
    running.current?.stop();
    running.current = Animated.timing(scale, {
      toValue: to,
      duration: t.press,
      easing: ease.out,
      useNativeDriver: true,
    });
    running.current.start();
  };
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => press(0.96)}
        onPressOut={() => press(1)}
        style={[styles.base, primary ? styles.primary : styles.secondary, disabled && styles.dim]}
      >
        <Text style={[styles.label, primary ? styles.primaryLabel : styles.secondaryLabel]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 5,
  },
  primary: { backgroundColor: colors.accent },
  // A tone step from the room, not an outline.
  secondary: { backgroundColor: colors.card },
  dim: { opacity: 0.5 },
  label: { fontSize: 17, fontWeight: '600' },
  primaryLabel: { color: colors.accentInk },
  secondaryLabel: { color: colors.ink },
});
