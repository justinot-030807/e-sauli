import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSize } from '@/constants/theme';

export default function LeaderboardScreen() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={styles.emoji}>🏆</Text>
      <Text style={[styles.title, { color: theme.text }]}>Leaderboard</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Coming in Phase 6
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  emoji: { fontSize: 56, marginBottom: Spacing.md },
  title: { fontSize: FontSize.xl, fontWeight: '700' },
  subtitle: { fontSize: FontSize.sm, marginTop: Spacing.xs },
});
