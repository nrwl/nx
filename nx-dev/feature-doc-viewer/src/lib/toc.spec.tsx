import React from 'react';
import { render } from '@testing-library/react';

import Toc from './toc';

describe('Toc', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Toc />);
    expect(baseElement).toBeTruthy();
  });
});
