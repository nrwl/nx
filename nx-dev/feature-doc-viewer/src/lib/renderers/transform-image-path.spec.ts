import { transformImagePath } from './transform-image-path';

describe('transformImagePath', () => {
  it('should transform relative paths', () => {
    const opts = {
      version: '1.0.0',
      document: { content: '', excerpt: '', filePath: 'a/b/test.md', data: {} },
    };
    const transform = transformImagePath(opts);

    expect(transform('./test.png')).toEqual('/documentation/a/b/test.png');
    expect(transform('../test.png')).toEqual('/documentation/a/test.png');
    expect(transform('../../test.png')).toEqual('/documentation/test.png');
  });

  it('should transform absolute paths', () => {
    const opts = {
      version: '1.0.0',
      document: { content: '', excerpt: '', filePath: 'a/b/test.md', data: {} },
    };
    const transform = transformImagePath(opts);

    expect(transform('/shared/test.png')).toEqual(
      '/documentation/1.0.0/shared/test.png'
    );
  });

  it('should support preview links', () => {
    const opts = {
      version: 'preview',
      document: { content: '', excerpt: '', filePath: 'a/b/test.md', data: {} },
    };
    const transform = transformImagePath(opts);

    expect(transform('/shared/test.png')).toEqual(
      '/api/preview-asset?uri=%2Fshared%2Ftest.png&document=a%2Fb%2Ftest.md'
    );
  });
});
