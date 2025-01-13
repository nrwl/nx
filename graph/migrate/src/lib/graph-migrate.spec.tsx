import { render } from '@testing-library/react';

import GraphMigrate from './graph-migrate';

describe('GraphMigrate', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<GraphMigrate />);
    expect(baseElement).toBeTruthy();
  });
});
