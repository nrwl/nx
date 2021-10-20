import { render } from '@testing-library/react';

import DependencyGraph from './dependency-graph';

describe('DependencyGraph', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<DependencyGraph />);
    expect(baseElement).toBeTruthy();
  });
});
