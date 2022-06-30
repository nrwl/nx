import { transformImagePath } from './transform-image-path';

describe('transformImagePath', () => {
  it('should transform relative paths', () => {
    const opts = {
      content: '',
      excerpt: '',
      filePath: 'nx-dev/nx-dev/public/documentation/shared/using-nx/dte.md',
      data: {},
    };
    const transform = transformImagePath(opts);

    expect(transform('./test.png')).toEqual(
      '/documentation/shared/using-nx/test.png'
    );
    expect(transform('../test.png')).toEqual('/documentation/shared/test.png');
    expect(transform('../../test.png')).toEqual('/documentation/test.png');
  });

  it('should transform absolute paths', () => {
    const opts = {
      content: '',
      excerpt: '',
      filePath:
        'nx-dev/nx-dev/public/documentation/angular/generators/workspace-generators.md',
      data: {},
    };
    const transform = transformImagePath(opts);

    expect(transform('/shared/test.png')).toEqual(
      '/documentation/shared/test.png'
    );
  });
});
