import { render } from '@testing-library/react';

import NxPlaybook from './nx-playbook';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';

describe('NxPlaybook', () => {
  it('should render successfully', () => {
    mockAllIsIntersecting(true);
    const { baseElement } = render(<NxPlaybook />);
    expect(baseElement).toBeTruthy();
  });
});
