import React from 'react';
import { render } from '@testing-library/react';

import Sidebar from './sidebar';

describe('Sidebar', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <Sidebar menu={{ version: 'preview', flavor: 'react', sections: [] }} />
    );
    expect(baseElement).toBeTruthy();
  });
});
