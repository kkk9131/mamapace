import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ChannelScreen from '../ChannelScreen';

jest.mock('../../hooks/useRooms', () => ({
  useChannelMessages: () => ({ messages: [], loading: false, error: null, hasMore: false, sendMessage: jest.fn(), loadMore: jest.fn(), markSeen: jest.fn(), refresh: jest.fn() }),
  useModeration: () => ({ loading: false, error: null, reportMessage: jest.fn() }),
  useSpaceOperations: () => ({ loading: false, error: null, leaveSpace: jest.fn() }),
  useChannelMembers: () => ({
    members: [{ user_id: 'u1', role: 'owner', channel_id: 'c1', last_seen_at: '', joined_at: '', is_active: true, user: null as any }],
    loading: false, error: null, refresh: jest.fn(),
  }),
}));

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
jest.mock('../../services/roomService', () => ({ roomService: { deleteSpace: jest.fn().mockResolvedValue({ success: true }) } }));

describe('ChannelScreen delete room flow (owner)', () => {
  it('calls deleteSpace when confirmed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons?: any[]) => {
      // Confirm deletion
      buttons?.find((b: any) => b.style === 'destructive')?.onPress?.();
    });

    const onBack = jest.fn();
    render(<ChannelScreen channelId="c1" spaceName="#general" spaceId="s1" onBack={onBack} />);

    fireEvent.press(screen.getByText('•••'));
    fireEvent.press(screen.getByText('ルーム削除'));
    expect(alertSpy).toHaveBeenCalled();
    // onBack gets called after successful deletion
    expect(onBack).toHaveBeenCalled();
  });
});

