import { render } from '@testing-library/react';

import OpenPlatform from './open-platform';

describe('OpenPlatform', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<OpenPlatform />);
    expect(baseElement).toBeTruthy();
  });
});
