import { render } from '@testing-library/react';

import Products from './products';

describe('Products', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Products />);
    expect(baseElement).toBeTruthy();
  });
});
