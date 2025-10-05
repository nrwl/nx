import { angularDevkitVersion } from './versions';

describe('Angular Versions', () => {
  it('angular CLI package should not use ^ package matching', () => {
    expect(angularDevkitVersion[0]).not.toEqual('^');
  });
});
