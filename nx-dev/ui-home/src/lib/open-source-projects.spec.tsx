import { render } from '@testing-library/react';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';
import OpenSourceProjects from './open-source-projects';

describe('OpenSourceProjects', () => {
  it('should render successfully', () => {
    mockAllIsIntersecting(true);
    const { baseElement } = render(<OpenSourceProjects />);
    expect(baseElement).toBeTruthy();
  });
});
