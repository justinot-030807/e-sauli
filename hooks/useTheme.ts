import { Colors } from '@/constants/theme';
import { useColorScheme } from './useColorScheme';

export function useTheme() {
  const colorScheme = useColorScheme();
  return Colors[colorScheme];
}
