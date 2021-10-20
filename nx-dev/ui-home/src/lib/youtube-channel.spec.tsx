import { render } from '@testing-library/react';

import YoutubeChannel from './youtube-channel';

describe('YoutubeChannel', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<YoutubeChannel />);
    expect(baseElement).toBeTruthy();
  });
});
