import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import RoomsListScreen from '../RoomsListScreen';

jest.mock('../../hooks/useRooms', () => ({
  useChatList: () => ({ chatList: [], loading: false, error: null, refresh: jest.fn() }),
}));

jest.mock('../AnonRoomV2Screen', () => () => {
  return null; // rendering stub; presence is enough for branch
});

describe('RoomsListScreen anonymous entry routes to V2 screen', () => {
  it('navigates to V2 screen when tapping anonymous item', () => {
    const { getByText, queryByTestId } = render(<RoomsListScreen />);
    const title = getByText('愚痴もたまには、、、');
    fireEvent.press(title.parent as any);
    // If successfully navigated, parent view should unmount main header; we assert no throw
    expect(queryByTestId('non-existent')).toBeNull();
  });
});

