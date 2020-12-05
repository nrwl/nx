import { offsetFromRoot } from './offset-from-root';

describe('offsetFromRoot', () => {
  it('should work for normal paths', () => {
    const result = offsetFromRoot('apps/appname');
    expect(result).toBe('../../');
  });

  it('should work for paths with a trailing slash', () => {
    const result = offsetFromRoot('apps/appname/');
    expect(result).toBe('../../');
  });

  it('should work for deep paths', () => {
    const result = offsetFromRoot('apps/dirname/appname');
    expect(result).toBe('../../../');
  });

  it('should work for deep paths with a trailing slash', () => {
    const result = offsetFromRoot('apps/dirname/appname/');
    expect(result).toBe('../../../');
  });
});
