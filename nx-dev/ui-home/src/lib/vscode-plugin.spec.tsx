import { render } from '@testing-library/react';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';
import VscodePlugin from './vscode-plugin';

describe('VscodePlugin', () => {
  it('should render successfully', () => {
    mockAllIsIntersecting(true);
    const { baseElement } = render(<VscodePlugin />);
    expect(baseElement).toBeTruthy();
  });
});
