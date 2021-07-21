import React from 'react';
import { render } from '@testing-library/react';

import Header from './header';

describe('Header', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <Header
        showSearch={true}
        flavor={{ name: 'react', value: 'react' }}
        version={{ name: 'latest', value: 'latest' }}
      />
    );
    expect(baseElement).toBeTruthy();
  });
});
