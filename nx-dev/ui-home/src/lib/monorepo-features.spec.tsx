import { render } from '@testing-library/react';

import MonorepoFeatures from './monorepo-features';

describe('MonorepoFeatures', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<MonorepoFeatures />);
    expect(baseElement).toBeTruthy();
  });
});
