import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSize, BorderRadius } from '@/constants/theme';

interface LoadingViewProps {
  message?: string;
}

export function LoadingView({ message = 'Kinakarga...' }: LoadingViewProps) {
  const theme = useTheme();

  return (
    <View style={[styles.centered, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.loadingText, { color: theme.textSecondary }]}>{message}</Text>
    </View>
  );
}

interface EmptyViewProps {
  emoji?: string;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyView({
  emoji = '📦',
  title = 'Walang nahanap na item',
  description = 'Subukang baguhin ang mga filter o maghanap ng ibang salita.',
  actionLabel,
  onAction,
}: EmptyViewProps) {
  const theme = useTheme();

  return (
    <View style={[styles.centered, { backgroundColor: theme.background }]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={onAction}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

interface ErrorViewProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorView({
  message = 'May problemang naganap habang kumakarga.',
  onRetry,
}: ErrorViewProps) {
  const theme = useTheme();

  return (
    <View style={[styles.centered, { backgroundColor: theme.background }]}>
      <Text style={styles.emoji}>⚠️</Text>
      <Text style={[styles.title, { color: theme.error }]}>Nagka-aberya</Text>
      <Text style={[styles.description, { color: theme.textSecondary }]}>{message}</Text>
      {onRetry && (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={onRetry}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Subukang Muli</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.sm,
  },
  emoji: {
    fontSize: 54,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  description: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
    maxWidth: 280,
  },
  button: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
