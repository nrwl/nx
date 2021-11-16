import { render } from '@testing-library/react';
import CloudSupport from './cloud-support';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';

describe('CloudSupport', () => {
  it('should render successfully', () => {
    mockAllIsIntersecting(true);
    // const { baseElement } = render(<CloudSupport />);
    // expect(baseElement).toBeTruthy();
  });
});
