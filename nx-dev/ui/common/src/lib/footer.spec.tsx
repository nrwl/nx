import React from 'react';
import { render } from '@testing-library/react';

import Footer from './footer';

describe('Footer', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <Footer
        flavor={{ name: 'react', value: 'react' }}
        version={{ name: 'latest', value: 'latest' }}
      />
    );
    expect(baseElement).toBeTruthy();
  });
});
