import { StyleSheet, Text, View } from 'react-native';

interface Props {
  title: string;
  note?: string;
}

/** Temporary screen body used until a route's milestone builds the real UI. */
export function PlaceholderScreen({ title, note }: Props) {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFF7EC',
  },
  title: { fontSize: 22, fontWeight: '600', color: '#3B2A1A' },
  note: { marginTop: 8, fontSize: 15, color: '#6B5844', textAlign: 'center' },
});
