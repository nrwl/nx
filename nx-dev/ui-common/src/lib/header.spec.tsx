import React from 'react';
import { render } from '@testing-library/react';

import Header from './header';

describe('Header', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Header showSearch={true} />);
    expect(baseElement).toBeTruthy();
  });
});
