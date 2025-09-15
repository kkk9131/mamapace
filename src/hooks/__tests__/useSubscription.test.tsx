import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { SubscriptionProvider, useSubscription } from '../../contexts/SubscriptionContext';

describe('useSubscription (skeleton)', () => {
  it('provides default state without crash', async () => {
    const wrapper = ({ children }: any) => (
      <SubscriptionProvider>{children}</SubscriptionProvider>
    );
    const { result } = renderHook(() => useSubscription(), { wrapper });
    expect(result.current.loading).toBe(false);
    // hasEntitlement should be false by default (no active status)
    expect(result.current.hasEntitlement('any')).toBe(false);
  });
});

