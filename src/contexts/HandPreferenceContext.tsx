import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type HandPreference = 'left' | 'right';

interface HandPreferenceContextType {
  handPreference: HandPreference;
  setHandPreference: (preference: HandPreference) => void;
  isLoading: boolean;
}

const HandPreferenceContext = createContext<HandPreferenceContextType | undefined>(undefined);

const HAND_PREFERENCE_KEY = '@mamapace_hand_preference';

export function HandPreferenceProvider({ children }: { children: React.ReactNode }) {
  const [handPreference, setHandPreferenceState] = useState<HandPreference>('right');
  const [isLoading, setIsLoading] = useState(true);

  // アプリ起動時に保存された設定を読み込み
  useEffect(() => {
    const loadHandPreference = async () => {
      try {
        const savedPreference = await AsyncStorage.getItem(HAND_PREFERENCE_KEY);
        if (savedPreference === 'left' || savedPreference === 'right') {
          setHandPreferenceState(savedPreference);
        }
      } catch (error) {
        console.error('手の設定の読み込みに失敗:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadHandPreference();
  }, []);

  // 設定を変更して保存
  const setHandPreference = async (preference: HandPreference) => {
    try {
      await AsyncStorage.setItem(HAND_PREFERENCE_KEY, preference);
      setHandPreferenceState(preference);
    } catch (error) {
      console.error('手の設定の保存に失敗:', error);
    }
  };

  const value: HandPreferenceContextType = {
    handPreference,
    setHandPreference,
    isLoading,
  };

  return (
    <HandPreferenceContext.Provider value={value}>
      {children}
    </HandPreferenceContext.Provider>
  );
}

export function useHandPreference() {
  const context = useContext(HandPreferenceContext);
  if (context === undefined) {
    throw new Error('useHandPreference must be used within a HandPreferenceProvider');
  }
  return context;
}