import { render } from '@testing-library/react';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';
import DependencyGraph from './dependency-graph';

describe('DependencyGraph', () => {
  it('should render successfully', () => {
    mockAllIsIntersecting(true);
    const { baseElement } = render(<DependencyGraph />);
    expect(baseElement).toBeTruthy();
  });
});
