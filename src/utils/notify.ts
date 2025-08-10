import { Alert, Platform, ToastAndroid } from 'react-native';

export function notifyError(message: string, title: string = 'エラー') {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert(title, message);
  }
}

export function notifyInfo(message: string, title: string = 'お知らせ') {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert(title, message);
  }
}
