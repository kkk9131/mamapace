import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

import ChannelScreen from '../ChannelScreen';

jest.mock('../../hooks/useRooms', () => ({
  useChannelMessages: () => ({
    messages: [],
    loading: false,
    error: null,
    hasMore: false,
    sendMessage: jest.fn(),
    loadMore: jest.fn(),
    markSeen: jest.fn(),
    refresh: jest.fn(),
  }),
  useModeration: () => ({
    loading: false,
    error: null,
    reportMessage: jest.fn(),
  }),
  useSpaceOperations: () => ({
    loading: false,
    error: null,
    leaveSpace: jest.fn().mockResolvedValue(true),
  }),
  useChannelMembers: () => ({
    members: [
      {
        user_id: 'u1',
        role: 'member',
        channel_id: 'c1',
        last_seen_at: '',
        joined_at: '',
        is_active: true,
        user: null as any,
      },
    ],
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

describe('ChannelScreen leave flow', () => {
  it('leaves room when confirmed', () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((title, message, buttons?: any[]) => {
        // Simulate tapping the destructive confirm button
        buttons?.find((b: any) => b.style === 'destructive')?.onPress?.();
      });

    render(<ChannelScreen channelId="c1" spaceName="#general" spaceId="s1" />);
    // open menu
    fireEvent.press(screen.getByText('•••'));
    // tap 退出
    fireEvent.press(screen.getByText('退出'));
    expect(alertSpy).toHaveBeenCalled();
  });
});
