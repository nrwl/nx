import React from 'react';
import { render } from '@testing-library/react';

import NpxCreateNxWorkspace from './npx-create-nx-workspace';

describe('NpxCreateNxWorkspace', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<NpxCreateNxWorkspace />);
    expect(baseElement).toBeTruthy();
  });
});
