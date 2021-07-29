import { render } from '@testing-library/react';
import { ConfWorkshop } from './conf-workshop';

describe('ConfWorkshop', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<ConfWorkshop />);
    expect(baseElement).toBeTruthy();
  });
});
