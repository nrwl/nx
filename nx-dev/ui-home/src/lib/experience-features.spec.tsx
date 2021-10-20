import { render } from '@testing-library/react';

import ExperienceFeatures from './experience-features';

describe('ExperienceFeatures', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<ExperienceFeatures />);
    expect(baseElement).toBeTruthy();
  });
});
