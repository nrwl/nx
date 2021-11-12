import { render } from '@testing-library/react';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';
import ExperienceFeatures from './experience-features';

describe('ExperienceFeatures', () => {
  it('should render successfully', () => {
    mockAllIsIntersecting(true);
    const { baseElement } = render(<ExperienceFeatures />);
    expect(baseElement).toBeTruthy();
  });
});
