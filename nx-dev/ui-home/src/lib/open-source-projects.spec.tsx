import { render } from '@testing-library/react';

import OpenSourceProjects from './open-source-projects';

describe('OpenSourceProjects', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<OpenSourceProjects />);
    expect(baseElement).toBeTruthy();
  });
});
