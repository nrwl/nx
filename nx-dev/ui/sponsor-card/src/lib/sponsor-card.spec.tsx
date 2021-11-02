import { render } from '@testing-library/react';
import { SponsorCard } from './sponsor-card';

describe('SponsorCard', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <SponsorCard
        description="description content"
        imageUrl="/image.png"
        name="name content"
        linkTarget=""
      />
    );
    expect(baseElement).toBeTruthy();
  });
});
