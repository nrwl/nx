import React from 'react';
import { render } from '@testing-library/react';

import NxUsersShowcase from './nx-users-showcase';

describe('NxUsersShowcase', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<NxUsersShowcase />);
    expect(baseElement).toBeTruthy();
  });
});
