import { render } from '@testing-library/react';

import AffectedCommand from './affected-command';

describe('AffectedCommand', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<AffectedCommand />);
    expect(baseElement).toBeTruthy();
  });
});
