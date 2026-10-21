// Entrance: rises 16px and fades in once, after `delay`. With reduce motion it simply is
// there; content is never hidden waiting for an animation.

import { useEffect, useState } from 'react';
import { Animated } from 'react-native';

import { ease, t } from './motion';

interface Props {
  children: React.ReactNode;
  delay?: number;
  reduceMotion: boolean;
}

export function Rise({ children, delay = 0, reduceMotion }: Props) {
  const [progress] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) return progress.setValue(1);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: t.reveal,
      delay,
      easing: ease.out,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, delay, reduceMotion]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  return (
    <Animated.View style={{ opacity: progress, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}
