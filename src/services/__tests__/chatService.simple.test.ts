import { chatService } from '../chatService';

// Simple integration test
describe('ChatService Integration', () => {
  it('should initialize without errors', async () => {
    expect(() => chatService).not.toThrow();
  });

  it('should have required methods', () => {
    expect(chatService.initialize).toBeDefined();
    expect(chatService.sendMessage).toBeDefined();
    expect(chatService.getConversations).toBeDefined();
    expect(chatService.subscribeToChat).toBeDefined();
  });
});