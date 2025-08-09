import React from 'react';
import { AuthProvider } from '../contexts/AuthContext';
import CustomTabs from './CustomTabs';

/**
 * Root navigation component that provides authentication context
 * and handles the main app navigation flow
 */
export default function RootNavigator() {
  return (
    <AuthProvider>
      <CustomTabs />
    </AuthProvider>
  );
}
