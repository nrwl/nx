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

  it.each([
    '@nx/js:swc',
    '@nx/esbuild:esbuild',
    '@nx/rollup:rollup',
    '@nx/vite:build',
  ])('should respect skipTypeCheck for %s', (executor) => {
    expect(buildTypechecksProject([], { build: { executor } })).toBe(true);
    expect(
      buildTypechecksProject([], {
        build: { executor, options: { skipTypeCheck: true } },
      })
    ).toBe(false);
  });

  it.each(['@nx/webpack:webpack', '@nx/rspack:rspack'])(
    'should respect the type checker options for %s',
    (executor) => {
      expect(buildTypechecksProject([], { build: { executor } })).toBe(true);
      for (const options of [
        { typeCheckOptions: false },
        { skipTypeChecking: true },
        { typeCheck: true },
        { typeCheckOptions: false, skipTypeChecking: false },
      ]) {
        expect(
          buildTypechecksProject([], { build: { executor, options } })
        ).toBe(false);
      }
      for (const options of [
        { typeCheck: false },
        { typeCheckOptions: { async: true }, skipTypeChecking: true },
      ]) {
        expect(
          buildTypechecksProject([], { build: { executor, options } })
        ).toBe(true);
      }
    }
  );

  it.each([
    ['webpack.config.js', '@nx/webpack:webpack', { skipTypeChecking: true }],
    ['rspack.config.ts', '@nx/rspack:rspack', { typeCheckOptions: false }],
    ['rollup.config.cjs', '@nx/rollup:rollup', { skipTypeCheck: true }],
  ])(
    'should read the executor options before assuming %s type-checks',
    (file, executor, options) => {
      expect(
        buildTypechecksProject([file, 'project.json'], {
          build: { executor, options },
        })
      ).toBe(false);
    }
  );

  it('should not flag builds that strip types', () => {
    expect(
      buildTypechecksProject(['vite.config.ts', 'tsconfig.json'], {
        build: { command: 'vite build' },
        serve: { executor: '@nx/vite:dev-server' },
      })
    ).toBe(false);
    expect(buildTypechecksProject([], undefined)).toBe(false);
  });
});
