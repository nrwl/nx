import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  const callback = vi.fn();
  const addDependency = vi.fn();
  const typescriptFileCache = new Map<string, string | Buffer>();
  const _compilation = {
    [NG_RSPACK_SYMBOL_NAME]: () => ({
      typescriptFileCache,
    }),
  } as unknown as NgRspackCompilation;
  const thisValue = {
    async: vi.fn(() => callback),
    _compilation: {},
  } as unknown as LoaderContext<unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('should emit an empty module when the angular compilation failed', () => {
    angularTransformLoader.call(
      {
        ...thisValue,
        _compilation: {
          [NG_RSPACK_SYMBOL_NAME]: () => ({
            typescriptFileCache,
            angularCompilationFailed: true,
          }),
        } as unknown as NgRspackCompilation,
        resourcePath: '/path/to/file.ts',
      },
      'content'
    );

    expect(callback).toHaveBeenCalledWith(null, '');
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

    expect(callback).toHaveBeenCalledWith(null, 'cached content', undefined);
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

    expect(callback).toHaveBeenCalledWith(null, 'cached content', undefined);
  });

  it('should extract an inline sourcemap and pass it to the callback', () => {
    const map = {
      version: 3,
      sources: ['app.component.ts'],
      sourcesContent: ['@Component()'],
      mappings: 'AAAA',
      names: [],
    };
    const inlineMap = Buffer.from(JSON.stringify(map)).toString('base64');
    // Built via concatenation so the test transform doesn't treat the literal
    // token in this source file as a real sourcemap reference.
    const comment =
      `//# source` +
      `MappingURL=data:application/json;charset=utf-8;base64,${inlineMap}`;
    typescriptFileCache.set(
      '/home/projects/analog/src/app/app.component.ts',
      `export class AppComponent {}\n${comment}\n`
    );

    angularTransformLoader.call(
      {
        ...thisValue,
        _compilation,
        resourcePath: '/home/projects/analog/src/app/app.component.ts',
      },
      '@Component()'
    );

    // The map is passed to Rspack as the decoded JSON string.
    expect(callback).toHaveBeenCalledWith(
      null,
      'export class AppComponent {}',
      JSON.stringify(map)
    );
  });
});
