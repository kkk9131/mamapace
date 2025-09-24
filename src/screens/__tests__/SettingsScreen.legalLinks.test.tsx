import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';

import SettingsScreen from '../SettingsScreen';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'me' },
    logout: jest.fn().mockResolvedValue(undefined),
    refreshToken: jest.fn(),
  }),
}));

describe('SettingsScreen - Legal Links', () => {
  it('opens Terms of Service link', async () => {
    render(<SettingsScreen /> as any);

    const terms = await screen.findByText('利用規約');
    fireEvent.press(terms);

    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
    );
  });

  it('opens Privacy Policy link', async () => {
    render(<SettingsScreen /> as any);

    const privacy = await screen.findByText('プライバシーポリシー');
    fireEvent.press(privacy);

    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://mama-pace.com/privacy.html',
    );
  });
});
