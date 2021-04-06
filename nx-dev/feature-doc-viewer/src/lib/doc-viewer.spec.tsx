import React from 'react';
import { render } from '@testing-library/react';

import DocViewer from './doc-viewer';

describe('DocViewer', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<DocViewer content="" sidebar="" toc="" />);
    expect(baseElement).toBeTruthy();
  });
});
