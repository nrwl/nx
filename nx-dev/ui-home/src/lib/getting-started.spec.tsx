import { render } from '@testing-library/react';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';
import GettingStarted from './getting-started';

describe('GettingStarted', () => {
  it('should render successfully', () => {
    mockAllIsIntersecting(true);
    const { baseElement } = render(<GettingStarted />);
    expect(baseElement).toBeTruthy();
  });
});
