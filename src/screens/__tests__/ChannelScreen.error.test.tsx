import React from 'react';
import { render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ChannelScreen from '../ChannelScreen';

jest.mock('../../hooks/useRooms', () => ({
  useChannelMessages: () => ({
    messages: [],
    loading: false,
    error: 'ネットワークエラー',
    hasMore: false,
    sendMessage: jest.fn(),
    loadMore: jest.fn(),
    markSeen: jest.fn(),
    refresh: jest.fn(),
  }),
  useModeration: () => ({ loading: false, error: null, reportMessage: jest.fn() }),
  useSpaceOperations: () => ({ loading: false, error: null, leaveSpace: jest.fn() }),
  useChannelMembers: () => ({ members: [], loading: false, error: null, refresh: jest.fn() }),
}));

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

describe('ChannelScreen error handling', () => {
  it('shows alert when error occurs', () => {
    const spy = jest.spyOn(Alert, 'alert');
    render(<ChannelScreen channelId="c1" spaceName="#general" spaceId="s1" />);
    expect(spy).toHaveBeenCalled();
  });
});

