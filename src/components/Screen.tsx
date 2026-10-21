import { Children } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from './AppProvider';
import { t as motion } from './motion';
import { Rise } from './Rise';
import { colors } from './theme';

interface Props {
  title?: string;
  children: React.ReactNode;
  scroll?: boolean;
  background?: string;
}

/** Page frame: safe area, optional header and scrolling. */
export function Screen({ title, children, scroll = true, background = colors.cream }: Props) {
  const { reduceMotion } = useApp();
  // Parts arrive in reading order: the title, then each child, 70 ms apart.
  const parts = [
    title ? (
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
    ) : null,
    ...Children.toArray(children),
  ].filter(Boolean);
  const body = parts.map((part, i) => (
    <Rise key={i} delay={i * motion.stagger} reduceMotion={reduceMotion}>
      {part}
    </Rise>
  ));
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content}>{body}</ScrollView>
      ) : (
        <View style={[styles.content, styles.fill]}>{body}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
  content: { padding: 20, gap: 8 },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink, marginBottom: 8 },
});
