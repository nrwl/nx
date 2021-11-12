import { render } from '@testing-library/react';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';
import MonorepoFeatures from './monorepo-features';

describe('MonorepoFeatures', () => {
  it('should render successfully', () => {
    mockAllIsIntersecting(true);
    const { baseElement } = render(<MonorepoFeatures />);
    expect(baseElement).toBeTruthy();
  });
});
