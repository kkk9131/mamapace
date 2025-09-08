import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AIChatBotScreen from '../AIChatBotScreen';

jest.mock('../../services/aiChatService', () => ({
  sendAIChat: jest.fn().mockResolvedValue({ ok: true, text: '応答', session_id: 'sid1' }),
}));

jest.mock('../../services/aiChatSessionService', () => ({
  listAISessions: jest.fn().mockResolvedValue([{ id: 'sid1', title: 'テスト', created_at: '', updated_at: '' }]),
  fetchAIMessages: jest.fn().mockResolvedValue([{ id: 'm1', role: 'assistant', content: '履歴' }]),
  createAISession: jest.fn(),
  deleteAISession: jest.fn(),
  updateAISessionTitle: jest.fn(),
  getAISession: jest.fn().mockResolvedValue({ id: 'sid1', title: 'テスト', created_at: '', updated_at: '' }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));

describe('AIChatBotScreen', () => {
  test('send message appends response', async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <AIChatBotScreen onBack={() => {}} />
    );
    const input = getByPlaceholderText('メッセージを入力');
    fireEvent.changeText(input, 'こんにちは');
    fireEvent.press(getByText('送信'));
    await waitFor(() => expect(queryByText('応答')).toBeTruthy());
  });

  test('open sessions modal', async () => {
    const { getByText } = render(<AIChatBotScreen onBack={() => {}} />);
    fireEvent.press(getByText('履歴'));
    await waitFor(() => expect(getByText('セッション一覧')).toBeTruthy());
  });
});

