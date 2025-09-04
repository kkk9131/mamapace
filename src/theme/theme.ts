import { dark, light } from './colors';
import { useColorScheme } from 'react-native';

export type Theme = {
  colors: typeof light;
  radius: { sm: number; md: number; lg: number };
  spacing: (n: number) => number;
  shadow: {
    card: {
      shadowColor: string;
      shadowOpacity: number;
      shadowRadius: number;
      shadowOffset: { width: number; height: number };
      elevation: number;
    };
  };
  typography: {
    title: { fontSize: 18; fontWeight: '700' };
    body: { fontSize: 16; fontWeight: '400' };
    caption: { fontSize: 12; fontWeight: '500' };
  };
};

export const useTheme = (): Theme => {
  const scheme = useColorScheme();
  const colors = scheme === 'light' ? light : dark;
  return {
    colors,
    radius: {
      sm: 10,
      md: 14,
      lg: 18,
    },
    spacing: (n: number) => n * 8,
    shadow: {
      card: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      },
    },
    typography: {
      title: { fontSize: 18 as const, fontWeight: '700' as const },
      body: { fontSize: 16 as const, fontWeight: '400' as const },
      caption: { fontSize: 12 as const, fontWeight: '500' as const },
    },
  };
};
