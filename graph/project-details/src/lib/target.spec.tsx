import { render } from '@testing-library/react';

import Target from './target';

describe('Target', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Target />);
    expect(baseElement).toBeTruthy();
  });
});
