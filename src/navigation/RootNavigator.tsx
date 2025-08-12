import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from '../contexts/AuthContext';
import CustomTabs from './CustomTabs';

/**
 * Root navigation component that provides authentication context
 * and handles the main app navigation flow
 */
export default function RootNavigator() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <CustomTabs />
      </NavigationContainer>
    </AuthProvider>
  );
}
