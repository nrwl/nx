import React from 'react';
import { render } from '@testing-library/react';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';
import Index from '../pages/index';

describe('Index', () => {
  it('should render successfully', () => {
    mockAllIsIntersecting(true);
    const { baseElement } = render(<Index />);
    expect(baseElement).toBeTruthy();
  });
});
