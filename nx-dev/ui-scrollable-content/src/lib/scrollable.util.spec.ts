import { getScrollDepth } from './scrollable.util';

describe('getScrollDepth', () => {
  it('should return in buckets of 25, 50, 75, and 90 percentages', () => {
    expect(getScrollDepth(0)).toEqual(0);
    expect(getScrollDepth(0.24)).toEqual(0);
    expect(getScrollDepth(0.25)).toEqual(25);
    expect(getScrollDepth(0.49)).toEqual(25);
    expect(getScrollDepth(0.5)).toEqual(50);
    expect(getScrollDepth(0.74)).toEqual(50);
    expect(getScrollDepth(0.75)).toEqual(75);
    expect(getScrollDepth(0.9)).toEqual(90);
    expect(getScrollDepth(1)).toEqual(90);
  });
});
