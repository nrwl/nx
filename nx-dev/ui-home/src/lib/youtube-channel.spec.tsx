import { render } from '@testing-library/react';

import YoutubeChannel from './youtube-channel';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';

describe('YoutubeChannel', () => {
  it('should render successfully', () => {
    mockAllIsIntersecting(true);
    const { baseElement } = render(<YoutubeChannel />);
    expect(baseElement).toBeTruthy();
  });
});
