import { Alert, Platform, type AlertButton } from 'react-native';

export function confirmAction(title: string, message: string, button: AlertButton) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm(title + '\n\n' + message)) button.onPress?.();
    return;
  }
  Alert.alert(title, message, [{ text: 'Kanselahin', style: 'cancel' }, button]);
}
