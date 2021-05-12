import React from 'react';
import { render } from '@testing-library/react';

import Content from './content';

describe('Content', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <Content
        version="1.0.0"
        flavor="react"
        document={{
          content: '',
          data: {},
          filePath: 'a/b/test.md',
          excerpt: '',
        }}
      />
    );
    expect(baseElement).toBeTruthy();
  });
});
