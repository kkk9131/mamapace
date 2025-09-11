import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { jest } from '@jest/globals';

jest.mock('../../services/blockService', () => ({
  blockUser: jest.fn(async () => {}),
}));

import PostCard from '../../components/PostCard';

const post = {
  id: 'p1',
  user_id: 'u1',
  body: 'hello',
  created_at: new Date().toISOString(),
  attachments: [],
  user: { username: 'alice', display_name: 'Alice' },
  reaction_summary: { reactedByMe: false, count: 0 },
  comment_summary: { count: 0 },
} as any;

describe('PostCard menu', () => {
  it('opens action menu alert on ⋯ press', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { getByA11yLabel } = render(<PostCard post={post} />);
    const menu = getByA11yLabel('その他の操作');
    fireEvent.press(menu);
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
