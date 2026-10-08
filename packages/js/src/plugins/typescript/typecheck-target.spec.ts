import {
  createTypecheckTarget,
  selectTypecheckTsConfig,
} from './typecheck-target';

const pmc = { exec: 'npx' } as any;

describe('createTypecheckTarget', () => {
  describe('build mode', () => {
    it('should leave the default tsconfig.json out of the command', () => {
      const target = createTypecheckTarget({
        mode: 'build',
        projectRoot: 'apps/app',
        pmc,
      });

      expect(target.command).toBe('tsc --build --emitDeclarationOnly');
      expect(target.options).toEqual({ cwd: 'apps/app' });
    });

    it('should pass a non-default tsconfig to --build', () => {
      const target = createTypecheckTarget({
        mode: 'build',
        projectRoot: 'apps/app',
        pmc,
        tsConfig: 'tsconfig.check.json',
        compiler: 'vue-tsc',
        verboseOutput: true,
      });

      expect(target.command).toBe(
        'vue-tsc --build tsconfig.check.json --emitDeclarationOnly --verbose'
      );
    });

    it('should depend on the build target and on referenced projects', () => {
      const target = createTypecheckTarget({
        mode: 'build',
        projectRoot: 'apps/app',
        pmc,
        targetName: 'check-types',
        buildTargetName: 'build',
      });

      expect(target.dependsOn).toEqual(['build', '^check-types']);
      expect(target.syncGenerators).toEqual(['@nx/js:typescript-sync']);
      expect(target.metadata.help).toEqual({
        command: 'npx tsc --build --help',
        example: { args: ['--force'] },
      });
    });
  });

  describe('noEmit mode', () => {
    it('should leave the default tsconfig.json out of the command', () => {
      const target = createTypecheckTarget({
        mode: 'noEmit',
        projectRoot: 'apps/app',
        pmc,
        tsConfig: 'tsconfig.json',
      });

      expect(target.command).toBe('tsc --noEmit');
      expect(target.metadata.help.command).toBe('npx tsc --help');
    });

    it('should pass a non-default tsconfig with -p', () => {
      const target = createTypecheckTarget({
        mode: 'noEmit',
        projectRoot: 'apps/app',
        pmc,
        tsConfig: 'tsconfig.app.json',
      });

      expect(target.command).toBe('tsc -p tsconfig.app.json --noEmit');
      expect(target.metadata.help).toEqual({
        command: 'npx tsc -p tsconfig.app.json --help',
        example: { options: { noEmit: true } },
      });
      expect(target.dependsOn).toBeUndefined();
      expect(target.syncGenerators).toBeUndefined();
    });

    it('should derive inputs from the named inputs and the compiler', () => {
      expect(
        createTypecheckTarget({
          mode: 'noEmit',
          projectRoot: 'apps/app',
          pmc,
          namedInputs: { production: [] },
          compiler: 'vue-tsc',
        }).inputs
      ).toEqual([
        'production',
        '^production',
        { externalDependencies: ['vue-tsc', 'typescript'] },
      ]);
      expect(
        createTypecheckTarget({
          mode: 'noEmit',
          projectRoot: 'apps/app',
          pmc,
          compiler: 'tsgo',
        }).inputs
      ).toEqual([
        'default',
        '^default',
        { externalDependencies: ['@typescript/native-preview'] },
      ]);
    });
  });
});

describe('selectTypecheckTsConfig', () => {
  it('should prefer the app, then the lib, then the root tsconfig', () => {
    expect(
      selectTypecheckTsConfig([
        'tsconfig.json',
        'tsconfig.lib.json',
        'tsconfig.app.json',
      ])
    ).toBe('tsconfig.app.json');
    expect(
      selectTypecheckTsConfig(['tsconfig.json', 'tsconfig.lib.json'])
    ).toBe('tsconfig.lib.json');
    expect(
      selectTypecheckTsConfig(['tsconfig.spec.json', 'tsconfig.json'])
    ).toBe('tsconfig.json');
  });

  it('should fall back to the first tsconfig', () => {
    expect(selectTypecheckTsConfig(['tsconfig.base.json'])).toBe(
      'tsconfig.base.json'
    );
    expect(selectTypecheckTsConfig([])).toBeUndefined();
  });
});
