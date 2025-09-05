import React from 'react';
import { render } from '@testing-library/react-native';
import AnonRoomV2Screen from '../AnonRoomV2Screen';

jest.mock('../../services/anonV2Service', () => ({
  fetchLiveMessages: jest.fn().mockResolvedValue([]),
  sendAnonMessage: jest.fn(),
}));

const mockOn = jest.fn();
const mockSubscribe = jest.fn(() => ({}));
jest.mock('../../services/supabaseClient', () => ({
  getSupabaseClient: () => ({
    channel: () => ({ on: mockOn, subscribe: mockSubscribe }),
    removeChannel: jest.fn(),
  }),
}));

describe('AnonRoomV2Screen realtime subscription', () => {
  it('subscribes with server-side filter scoped to current slot', async () => {
    render(<AnonRoomV2Screen onBack={() => {}} />);
    const call = mockOn.mock.calls.find(
      (c: any[]) => c[0] === 'postgres_changes'
    );
    expect(call).toBeTruthy();
    const opts = call?.[1];
    expect(opts?.table).toBe('room_messages');
    expect(String(opts?.filter)).toBe('anonymous_room_id=eq.anon_20250101_10');
  });
});
jest.mock('../../services/anonV2Service', () => ({
  fetchLiveMessages: jest.fn().mockResolvedValue([]),
  sendAnonMessage: jest.fn(),
  getCurrentAnonSlotId: jest.fn().mockResolvedValue('anon_20250101_10'),
}));
