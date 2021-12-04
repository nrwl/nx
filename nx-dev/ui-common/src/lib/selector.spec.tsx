import React from 'react';
import { render } from '@testing-library/react';

import Selector from './selector';

describe('Selector', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <Selector
        items={[
          { label: 'Latest', value: 'latest' },
          { label: 'Previous', value: 'previous' },
        ]}
        selected={{ label: 'Latest', value: 'latest' }}
        onChange={(item) => void 0}
      />
    );
    expect(baseElement).toBeTruthy();
  });
});
