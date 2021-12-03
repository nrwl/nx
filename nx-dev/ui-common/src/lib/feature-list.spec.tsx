import React from 'react';
import { render } from '@testing-library/react';

import FeatureList from './feature-list';

describe('FeatureList', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<FeatureList />);
    expect(baseElement).toBeTruthy();
  });
});
