import React from 'react';
import { render, screen } from '@testing-library/react-native';
import RoomsListScreen from '../RoomsListScreen';

jest.mock('../../hooks/useRooms', () => ({
  useChatList: () => ({
    chatList: [
      {
        channel_id: 'c1',
        space_id: 's1',
        space_name: 'テストルーム',
        space_is_public: true,
        channel_name: 'general',
        member_role: 'member',
        last_seen_at: new Date().toISOString(),
        latest_message_at: null,
        latest_message_content: null,
        latest_message_sender_id: null,
        latest_message_sender_username: null,
        has_new: false,
        unread_count: 0,
      },
    ],
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

describe('RoomsListScreen', () => {
  it('renders chat list item', () => {
    render(<RoomsListScreen />);
    expect(screen.getByText('テストルーム')).toBeTruthy();
  });
});

