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
    error: 'エラー発生',
    joinSpace: jest.fn(async () => null),
  }),
  useSpacePermissions: () => ({ canCreateSpaces: () => true }),
}));

describe('RoomsScreen join error flow', () => {
  it('alerts error on join failure', () => {
    const spy = jest.spyOn(Alert, 'alert');
    render(<RoomsScreen />);
    fireEvent.press(screen.getByText('参加'));
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toBe('エラー');
  });
});
