import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

import RoomsScreen from '../RoomsScreen';

jest.mock('../../hooks/useRooms', () => ({
  useSpaceSearch: () => ({
    spaces: [],
    loading: false,
    error: null,
    searchSpaces: jest.fn(),
    clearResults: jest.fn(),
  }),
  usePopularSpaces: () => ({
    spaces: [
      {
        id: 's1',
        name: '人気ルーム',
        description: 'desc',
        tags: [],
        is_public: true,
        owner_id: 'u1',
        max_members: 500,
        member_count: 0,
        created_at: '',
        updated_at: '',
        owner: {
          id: 'u1',
          username: 'owner',
          display_name: 'オーナー',
          avatar_emoji: '👩‍🍼',
          avatar_url: null,
        },
        can_join: true,
      },
    ],
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
  useSpaceOperations: () => ({
    loading: false,
    error: null,
    joinSpace: jest.fn(async () => ({ channel_id: 'c1' })),
  }),
  useSpacePermissions: () => ({ canCreateSpaces: () => true }),
}));

describe('RoomsScreen join flow', () => {
  it('alerts success after joining a space', () => {
    const spy = jest.spyOn(Alert, 'alert');
    render(<RoomsScreen />);
    const joinButton = screen.getByText('参加');
    fireEvent.press(joinButton);
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toBe('参加完了');
  });
});
