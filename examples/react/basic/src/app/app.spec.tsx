import { render } from '@testing-library/react';

import App from './app';

describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<App />);
    expect(baseElement).toBeTruthy();
  });

  it('should have a welcome message', () => {
    const { getByText } = render(<App />);
    expect(getByText(/Welcome examples-react-basic/i)).toBeTruthy();
  });
});
