import React from 'react';
import { render } from '@testing-library/react';

import DocViewer from './doc-viewer';

describe('DocViewer', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <DocViewer
        version="1.0.0"
        flavor="react"
        document={{ content: '', data: {}, excerpt: '', filePath: '' }}
        menu={{ version: 'preview', flavor: 'react', sections: [] }}
        toc=""
      />
    );
    expect(baseElement).toBeTruthy();
  });
});
