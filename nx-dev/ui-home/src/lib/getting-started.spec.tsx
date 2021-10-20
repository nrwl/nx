import { render } from '@testing-library/react';

import GettingStarted from './getting-started';

describe('GettingStarted', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<GettingStarted />);
    expect(baseElement).toBeTruthy();
  });
});
