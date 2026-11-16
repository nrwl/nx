import { buildTypechecksProject } from './build-typechecks';

describe('buildTypechecksProject', () => {
  it.each(['webpack.config.js', 'rspack.config.ts', 'rollup.config.cjs'])(
    'should assume a %s build type-checks',
    (file) => {
      expect(buildTypechecksProject([file, 'project.json'], {})).toBe(true);
    }
  );

  it.each([
    '@nx/js:tsc',
    '@nx/angular:application',
    '@angular-devkit/build-angular:browser',
    '@angular/build:ng-packagr',
  ])('should detect %s', (executor) => {
    expect(buildTypechecksProject([], { build: { executor } })).toBe(true);
  });

  it.each(['@nx/js:swc', '@nx/esbuild:esbuild'])(
    'should respect skipTypeCheck for %s',
    (executor) => {
      expect(buildTypechecksProject([], { build: { executor } })).toBe(true);
      expect(
        buildTypechecksProject([], {
          build: { executor, options: { skipTypeCheck: true } },
        })
      ).toBe(false);
    }
  );

  it('should read the executor options before assuming a bundler config type-checks', () => {
    expect(
      buildTypechecksProject(['rollup.config.cjs', 'project.json'], {
        build: {
          executor: '@nx/esbuild:esbuild',
          options: { skipTypeCheck: true },
        },
      })
    ).toBe(false);
  });

  it('should not flag builds that strip types', () => {
    expect(
      buildTypechecksProject(['vite.config.ts', 'tsconfig.json'], {
        build: { command: 'vite build' },
      })
    ).toBe(false);
    expect(buildTypechecksProject([], undefined)).toBe(false);
  });
});
