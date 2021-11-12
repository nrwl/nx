import { render } from '@testing-library/react';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';
import AffectedCommand from './affected-command';

describe('AffectedCommand', () => {
  it('should render successfully', () => {
    mockAllIsIntersecting(true);
    const { baseElement } = render(<AffectedCommand />);
    expect(baseElement).toBeTruthy();
  });
});
