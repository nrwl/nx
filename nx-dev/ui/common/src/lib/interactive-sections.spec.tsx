import { render } from '@testing-library/react';

import InteractiveSections from './interactive-sections';

// Mocking matchMedia
global.matchMedia = () => void 0;

describe('InteractiveSections', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<InteractiveSections itemList={[]} />);
    expect(baseElement).toBeTruthy();
  });
});
