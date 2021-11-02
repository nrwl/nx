import { render } from '@testing-library/react';
import { ConfSpeakers } from './conf-speakers';

describe('ConfSpeakers', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<ConfSpeakers />);
    expect(baseElement).toBeTruthy();
  });
});
