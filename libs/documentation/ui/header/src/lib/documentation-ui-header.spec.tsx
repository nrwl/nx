import React from 'react';
import { render } from '@testing-library/react';

import DocumentationUiHeader from './documentation-ui-header';

describe('DocumentationUiHeader', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<DocumentationUiHeader />);
    expect(baseElement).toBeTruthy();
  });
});
