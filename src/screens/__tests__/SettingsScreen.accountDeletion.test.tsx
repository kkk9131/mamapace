import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import SettingsScreen from '../SettingsScreen';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'me' },
    logout: jest.fn().mockResolvedValue(undefined),
    refreshToken: jest.fn(),
  }),
}));

jest.mock('../../services/accountDeletionService', () => ({
  accountDeletionService: {
    deleteMyAccount: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('SettingsScreen - Account Deletion', () => {
  it('opens modal and calls service with password', async () => {
    render(<SettingsScreen /> as any);

    // Open delete modal
    const delBtn = await screen.findByText('アカウントを削除');
    fireEvent.press(delBtn);

    // Type password
    const input = await screen.findByPlaceholderText('現在のパスワード');
    fireEvent.changeText(input, 'pw123');

    // Confirm delete
    const confirm = await screen.findByText('完全に削除する');
    fireEvent.press(confirm);

    const { accountDeletionService } = jest.requireMock('../../services/accountDeletionService');
    await waitFor(() => {
      expect(accountDeletionService.deleteMyAccount).toHaveBeenCalledWith('pw123');
    });
  });
});

