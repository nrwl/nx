import React from 'react';
import { render } from '@testing-library/react';

import InlineCommand from './inline-command';

describe('InlineCommand', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <InlineCommand command={'npx create-nx-workspace'} language={'bash'} />
    );
    expect(baseElement).toBeTruthy();
  });
});
