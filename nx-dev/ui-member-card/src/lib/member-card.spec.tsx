import { render } from '@testing-library/react';
import { MemberCard } from './member-card';

describe('MemberCard', () => {
  xit('should render successfully', () => {
    const { baseElement } = render(
      <MemberCard
        description="description content"
        imageUrl="./image.png"
        name="name content"
      />
    );
    expect(baseElement).toBeTruthy();
  });
});
