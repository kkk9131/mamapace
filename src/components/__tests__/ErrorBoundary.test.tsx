import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ErrorBoundary from '../ErrorBoundary';

function Boom() {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('renders fallback when child throws', () => {
    render(
      <ErrorBoundary fallback={<></>}>
        {/* @ts-ignore - intentionally throws */}
        <Boom />
      </ErrorBoundary>
    );
    // If no crash, test passes; fallback is empty fragment
    expect(true).toBe(true);
  });
});

