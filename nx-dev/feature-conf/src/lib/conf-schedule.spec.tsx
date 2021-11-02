import { render } from '@testing-library/react';
import { ConfSchedule } from './conf-schedule';

describe('ConfSchedule', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<ConfSchedule />);
    expect(baseElement).toBeTruthy();
  });
});
