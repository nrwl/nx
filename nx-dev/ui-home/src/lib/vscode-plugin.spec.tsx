import { render } from '@testing-library/react';

import VscodePlugin from './vscode-plugin';

describe('VscodePlugin', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<VscodePlugin />);
    expect(baseElement).toBeTruthy();
  });
});
