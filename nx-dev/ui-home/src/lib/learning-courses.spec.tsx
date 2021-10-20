import { render } from '@testing-library/react';

import LearningCourses from './learning-courses';

describe('LearningCourses', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<LearningCourses />);
    expect(baseElement).toBeTruthy();
  });
});
