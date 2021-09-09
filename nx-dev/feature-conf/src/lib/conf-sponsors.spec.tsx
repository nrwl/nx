import { render } from '@testing-library/react';
import { ConfSponsors } from './conf-sponsors';

describe('ConfSponsors', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<ConfSponsors />);
    expect(baseElement).toBeTruthy();
  });
});
