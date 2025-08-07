import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { LinearGradient } from 'expo-linear-gradient';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#0E0F12","#19141A","#221821","#2C1C28","#402330"]} start={{x:0,y:0}} end={{x:1,y:1}} style={{ flex: 1 }}>
        <RootNavigator />
      </LinearGradient>
    </SafeAreaProvider>
  );
}
