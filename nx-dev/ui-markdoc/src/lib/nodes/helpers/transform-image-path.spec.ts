import { transformImagePath } from './transform-image-path';
import { join, sep } from 'path';

describe('transformImagePath', () => {
  it('should transform relative paths', () => {
    const transform = transformImagePath(
      'nx-dev/nx-dev/public/documentation/shared/using-nx/dte.md'
    );

    expect(transform('./test.png')).toEqual(
      sep + join('documentation', 'shared', 'using-nx', 'test.png')
    );
    expect(transform('../test.png')).toEqual(
      sep + join('documentation', 'shared', 'test.png')
    );
    expect(transform('../../test.png')).toEqual(
      sep + join('documentation', 'test.png')
    );
  });

  it('should transform absolute paths', () => {
    const transform = transformImagePath(
      'nx-dev/nx-dev/public/documentation/angular/generators/workspace-generators.md'
    );

    expect(transform('/shared/test.png')).toEqual(
      '/documentation/shared/test.png'
    );
  });
});
