import React from 'react';
import { render, act } from '@testing-library/react-native';
import { jest } from '@jest/globals';

// Mock block service methods
const mockBlock = jest.fn(async (_: string) => {});
const mockUnblock = jest.fn(async (_: string) => {});
const mockList = jest.fn(async () => []);

jest.mock('../../services/blockService', () => ({
  blockUser: (id: string) => mockBlock(id),
  unblockUser: (id: string) => mockUnblock(id),
  listBlockedUsers: () => mockList(),
}));

import { useBlockedList } from '../useBlock';

function Harness({ onReady }: { onReady: (api: ReturnType<typeof useBlockedList>) => void }) {
  const api = useBlockedList();
  React.useEffect(() => {
    onReady(api);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.blocked, api.loading, api.mutating]);
  return null;
}

describe('useBlockedList', () => {
  beforeEach(() => {
    mockBlock.mockReset();
    mockUnblock.mockReset();
    mockList.mockReset().mockResolvedValue([]);
  });

  it('adds user to blocked on successful block', async () => {
    let api: any;
    render(<Harness onReady={v => (api = v)} />);
    await act(async () => {
      await api.block('u1');
    });
    expect(api.blocked).toContain('u1');
  });

  it('does not update state when block fails', async () => {
    mockBlock.mockRejectedValueOnce(new Error('fail'));
    let api: any;
    render(<Harness onReady={v => (api = v)} />);
    await expect(
      act(async () => {
        await api.block('u2');
      })
    ).rejects.toThrow('fail');
    expect(api.blocked).not.toContain('u2');
  });
});

