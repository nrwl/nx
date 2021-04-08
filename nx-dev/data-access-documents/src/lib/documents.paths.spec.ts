import { getVersionRootPath } from './documents.paths';

describe('getDocumentsPath', () => {
  it('should support preview', () => {
    expect(getVersionRootPath('preview')).toMatch('docs');
  });

  it('should support latest', () => {
    expect(getVersionRootPath('latest')).toMatch(/archive\/\d+\.\d+\.\d+/);
  });

  it('should support previous', () => {
    expect(getVersionRootPath('previous')).toMatch(/archive\/\d+\.\d+\.\d+/);
  });
});
