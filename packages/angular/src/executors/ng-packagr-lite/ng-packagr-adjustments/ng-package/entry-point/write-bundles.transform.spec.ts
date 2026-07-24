import { dirname, join, relative, resolve } from 'node:path';
import {
  remapDeclarationMapSources,
  removeSourceMappingUrl,
} from './write-bundles.transform';

describe('removeSourceMappingUrl', () => {
  // the flat module file as ngc emits it
  const flatModule = [
    '/**',
    ' * Generated bundle index. Do not edit.',
    ' */',
    `export * from './public-api';`,
    '',
  ].join('\n');

  it('removes a trailing source map reference', () => {
    expect(
      removeSourceMappingUrl(
        `${flatModule}//# sourceMappingURL=my-lib.d.ts.map`
      )
    ).toBe(flatModule);
  });

  it('removes a trailing source map reference followed by a newline', () => {
    expect(
      removeSourceMappingUrl(
        `${flatModule}//# sourceMappingURL=my-lib.d.ts.map\n`
      )
    ).toBe(flatModule);
  });

  it('returns the content untouched when there is no source map reference', () => {
    expect(removeSourceMappingUrl(flatModule)).toBe(flatModule);
  });

  it('only removes the reference when it is the last thing in the file', () => {
    const content = `//# sourceMappingURL=my-lib.d.ts.map\n${flatModule}`;
    expect(removeSourceMappingUrl(content)).toBe(content);
  });
});

describe('remapDeclarationMapSources', () => {
  const dest = resolve('/tmp/dist/my-lib');
  // ngc emits declaration maps under tmp-typings; the transform moves them up
  // one directory by dropping the tmp-typings segment.
  const originalPath = join(dest, 'tmp-typings', 'lib', 'foo.d.ts.map');
  const newPath = join(dest, 'lib', 'foo.d.ts.map');

  function makeMap(sources: string[], sourceRoot = ''): string {
    return JSON.stringify({
      version: 3,
      file: 'foo.d.ts',
      sourceRoot,
      sources,
      names: [],
      mappings: 'AAAA',
    });
  }

  it('rebases sources so they still point at the original source after the move up a directory', () => {
    // source path as ngc emits it, relative to the tmp-typings location
    const emitted = relative(
      dirname(originalPath),
      resolve('/tmp/src/lib/foo.ts')
    );

    const result = remapDeclarationMapSources(
      originalPath,
      newPath,
      makeMap([emitted])
    );

    const { sources } = JSON.parse(result);
    // one fewer '../' now that the map lives one directory higher
    expect(sources).toEqual(['../../../src/lib/foo.ts']);
    // the rebased path resolves to the same absolute source file
    expect(resolve(dirname(newPath), sources[0])).toEqual(
      resolve('/tmp/src/lib/foo.ts')
    );
  });

  it('preserves the JSON structure and only rewrites sources', () => {
    const result = JSON.parse(
      remapDeclarationMapSources(
        originalPath,
        newPath,
        makeMap(['../../../../src/lib/foo.ts'])
      )
    );

    expect(result).toMatchObject({
      version: 3,
      file: 'foo.d.ts',
      names: [],
      mappings: 'AAAA',
    });
  });

  it('returns the content untouched when a sourceRoot is set', () => {
    // the root is prepended to each source, so they are not map-relative paths
    const content = makeMap(['lib/foo.ts'], 'https://cdn.example/src/');
    expect(remapDeclarationMapSources(originalPath, newPath, content)).toBe(
      content
    );
  });

  it('returns the content untouched when the map does not change directory', () => {
    const content = makeMap(['../../src/lib/foo.ts']);
    expect(remapDeclarationMapSources(newPath, newPath, content)).toBe(content);
  });

  it('returns the content untouched when it is not a valid source map', () => {
    expect(remapDeclarationMapSources(originalPath, newPath, 'not json')).toBe(
      'not json'
    );
  });

  it.each([
    ['null JSON', 'null'],
    ['a JSON primitive', '123'],
    ['a map without sources', '{"version":3}'],
    ['a map whose sources is not an array', '{"version":3,"sources":"foo.ts"}'],
  ])('returns the content untouched for %s', (_name, content) => {
    expect(remapDeclarationMapSources(originalPath, newPath, content)).toBe(
      content
    );
  });

  it('leaves non-string source entries untouched while rebasing string ones', () => {
    const result = JSON.parse(
      remapDeclarationMapSources(
        originalPath,
        newPath,
        JSON.stringify({
          version: 3,
          sources: [null, '../../../../src/lib/foo.ts'],
        })
      )
    );

    expect(result.sources[0]).toBeNull();
    expect(resolve(dirname(newPath), result.sources[1])).toEqual(
      resolve('/tmp/src/lib/foo.ts')
    );
  });
});
