import { render } from '@testing-library/react';

import CloudSupport from './cloud-support';

describe('CloudSupport', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<CloudSupport />);
    expect(baseElement).toBeTruthy();
  });
});
