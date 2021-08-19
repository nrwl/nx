import { transformImagePath } from './transform-image-path';

describe('transformImagePath', () => {
  it('should transform relative paths', () => {
    const opts = {
      version: 'latest',
      document: {
        content: '',
        excerpt: '',
        filePath: 'latest/react/test.md',
        data: {},
      },
    };
    const transform = transformImagePath(opts);

    expect(transform('./test.png')).toEqual(
      '/documentation/latest/react/test.png'
    );
    expect(transform('../test.png')).toEqual('/documentation/latest/test.png');
    expect(transform('../../test.png')).toEqual('/documentation/test.png');
  });

  it('should transform relative paths for previews on vercel', () => {
    const opts = {
      version: 'preview',
      document: {
        content: '',
        excerpt: '',
        filePath: 'react/test.md',
        data: {},
      },
    };
    const transform = transformImagePath(opts);

    expect(transform('./test.png')).toEqual(
      '/api/preview-asset?uri=.%2Ftest.png&document=react%2Ftest.md'
    );
  });

  it('should transform absolute paths', () => {
    const opts = {
      version: 'latest',
      document: {
        content: '',
        excerpt: '',
        filePath: 'latest/b/test.md',
        data: {},
      },
    };
    const transform = transformImagePath(opts);

    expect(transform('/shared/test.png')).toEqual(
      '/documentation/latest/shared/test.png'
    );
  });

  it('should support preview links', () => {
    const opts = {
      version: 'preview',
      document: {
        content: '',
        excerpt: '',
        filePath: 'react/test.md',
        data: {},
      },
    };
    const transform = transformImagePath(opts);

    expect(transform('/shared/test.png')).toEqual(
      '/api/preview-asset?uri=%2Fshared%2Ftest.png&document=react%2Ftest.md'
    );
  });
});
