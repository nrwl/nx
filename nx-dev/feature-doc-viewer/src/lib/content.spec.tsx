import React from 'react';
import { render } from '@testing-library/react';

import Content from './content';

describe('Content', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Content data="hello" />);
    expect(baseElement).toBeTruthy();
  });
});
