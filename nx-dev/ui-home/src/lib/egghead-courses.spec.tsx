import { render } from '@testing-library/react';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';
import EggheadCourses from './egghead-courses';

describe('EggheadCourses', () => {
  it('should render successfully', () => {
    mockAllIsIntersecting(true);
    const { baseElement } = render(<EggheadCourses />);
    expect(baseElement).toBeTruthy();
  });
});
