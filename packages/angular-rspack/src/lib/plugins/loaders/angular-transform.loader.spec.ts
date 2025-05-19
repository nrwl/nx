import { default as angularTransformLoader } from './angular-transform.loader';
import { NG_RSPACK_SYMBOL_NAME, type NgRspackCompilation } from '../../models';
import type { LoaderContext } from '@rspack/core';

class StyleUrlsResolverMock {
  constructor(private cb: (content: string) => string) {}

  resolve(content: string, _: string): string[] {
    return [this.cb(content)];
  }
}

class TemplateUrlsResolverMock {
  constructor(private cb: (content: string) => string) {}

  resolve(content: string, _: string): string[] {
    return [this.cb(content)];
  }
}

describe('angular-transform.loader', () => {
  const callback = jest.fn();
  const addDependency = jest.fn();
  const typescriptFileCache = new Map<string, string | Buffer>();
  const _compilation = {
    [NG_RSPACK_SYMBOL_NAME]: () => ({
      typescriptFileCache,
    }),
  } as unknown as NgRspackCompilation;
  const thisValue = {
    async: jest.fn(() => callback),
    _compilation: {},
  } as unknown as LoaderContext<unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return content when NG_RSPACK_SYMBOL_NAME is undefined', () => {
    angularTransformLoader.call(thisValue, 'content');
    expect(callback).toHaveBeenCalledWith(null, 'content');
  });

  it('should add dependencies for resolved template and style URLs', () => {
    angularTransformLoader.call(
      {
        ...thisValue,
        _compilation,
        resourcePath: '/home/projects/analog/src/app/app.component.ts',
        addDependency,
      },
      '@Component()',
      {
        templateUrlsResolver: new TemplateUrlsResolverMock(
          () =>
            './app.component.html|/home/projects/analog/src/app/app.component.html'
        ),
        styleUrlsResolver: new StyleUrlsResolverMock(
          () =>
            './app.component.css|/home/projects/analog/src/app/app.component.css'
        ),
      } as any
    );

    expect(addDependency).toHaveBeenCalledTimes(2);
    expect(addDependency).toHaveBeenNthCalledWith(
      1,
      '/home/projects/analog/src/app/app.component.html'
    );
    expect(addDependency).toHaveBeenNthCalledWith(
      2,
      '/home/projects/analog/src/app/app.component.css'
    );
  });

  it('should return content when typescriptFileCache does not contain normalizedRequest', () => {
    angularTransformLoader.call(
      {
        ...thisValue,
        _compilation,
        resourcePath: '/path/to/file.ts',
      },
      'content'
    );

    expect(callback).toHaveBeenCalledWith(null, 'content');
  });

  it('should return content when typescriptFileCache does contain string', () => {
    typescriptFileCache.set(
      '/home/projects/analog/src/app/app.component.ts',
      'cached content'
    );

    angularTransformLoader.call(
      {
        ...thisValue,
        _compilation,
        resourcePath: '/home/projects/analog/src/app/app.component.ts',
      },
      '@Component()'
    );

    expect(callback).toHaveBeenCalledWith(null, 'cached content');
  });

  it('should return content when typescriptFileCache does contain Buffer', () => {
    typescriptFileCache.set(
      '/home/projects/analog/src/app/app.component.ts',
      Buffer.from('cached content')
    );

    angularTransformLoader.call(
      {
        ...thisValue,
        _compilation,
        resourcePath: '/home/projects/analog/src/app/app.component.ts',
      },
      '@Component()'
    );

    expect(callback).toHaveBeenCalledWith(null, Buffer.from('cached content'));
  });
});
