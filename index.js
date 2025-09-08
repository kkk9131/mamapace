import 'react-native-gesture-handler';
// Polyfills required by @supabase/supabase-js in React Native / Expo Go
// Must be imported before anything that initializes Supabase
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { registerRootComponent } from 'expo';
import App from './App';
registerRootComponent(App);
