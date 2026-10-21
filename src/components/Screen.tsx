import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from './theme';

interface Props {
  title?: string;
  children: React.ReactNode;
  scroll?: boolean;
  background?: string;
}

/** Page frame: safe area, optional header and scrolling. */
export function Screen({ title, children, scroll = true, background = colors.cream }: Props) {
  const body = (
    <>
      {title ? (
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      ) : null}
      {children}
    </>
  );
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
