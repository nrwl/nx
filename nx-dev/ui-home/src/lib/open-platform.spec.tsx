import { render } from '@testing-library/react';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';
import OpenPlatform from './open-platform';

describe('OpenPlatform', () => {
  it('should render successfully', () => {
    mockAllIsIntersecting(true);
    const { baseElement } = render(<OpenPlatform />);
    expect(baseElement).toBeTruthy();
  });
});
