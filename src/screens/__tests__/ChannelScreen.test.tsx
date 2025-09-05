import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

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
        role: 'owner',
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

describe('ChannelScreen', () => {
  it('shows owner menu item to delete room', async () => {
    render(
      <ChannelScreen
        channelId="c1"
        spaceName="#general"
        spaceId="s1"
        isPrivateSpace={false}
      />
    );

    // open three dots menu
    const dots = await screen.findByText('•••');
    fireEvent.press(dots);

    // owner-only delete button should appear
    expect(await screen.findByText('ルーム削除')).toBeTruthy();
  });
});
