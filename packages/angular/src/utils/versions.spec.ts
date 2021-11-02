import { angularDevkitVersion } from './versions';

describe('Angular Versions', () => {
  it('angular CLI package should use ~ package matching', () => {
    expect(angularDevkitVersion[0]).toEqual('~');
  });
});
