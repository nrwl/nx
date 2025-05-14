import { render } from '@testing-library/react';

import Orders from './orders';

describe('Orders', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Orders />);
    expect(baseElement).toBeTruthy();
  });
});
