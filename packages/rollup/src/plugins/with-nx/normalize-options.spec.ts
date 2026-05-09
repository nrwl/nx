import { normalizeOptions } from './normalize-options';

jest.mock('@nx/js', () => ({
  ...jest.requireActual('@nx/js'),
  createEntryPoints: (x: string) => x,
}));

// This spec simulates a non-TS-solution workspace via `workspaceRoot: '/tmp'`
// (where tsconfig.base.json doesn't exist). The global mock in
// `scripts/unit-test-setup.js` short-circuits `isUsingTsSolutionSetup()` before
// any fs read, so we override it here to explicitly express the intent.
jest.mock('@nx/js/src/utils/typescript/ts-solution-setup', () => ({
  ...jest.requireActual('@nx/js/src/utils/typescript/ts-solution-setup'),
  isUsingTsSolutionSetup: jest.fn(() => false),
}));

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  workspaceRoot: '/tmp',
}));

jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  statSync: () => ({ isDirectory: () => true }),
}));

describe('normalizeOptions', () => {
  it('should provide defaults', () => {
    const result = normalizeOptions('pkg', 'pkg', {
      main: './src/main.ts',
      tsConfig: './tsconfig.json',
      outputPath: '../dist/pkg',
    });

    expect(result).toMatchObject({
      allowJs: false,
      assets: [],
      babelUpwardRootMode: false,
      buildLibsFromSource: true,
      compiler: 'babel',
      deleteOutputPath: true,
      extractCss: true,
      generateExportsField: false,
      javascriptEnabled: false,
      skipTypeCheck: false,
      skipTypeField: false,
    });
  });

  describe('buildLibsFromSource', () => {
    it('should default to true to match the executor schema default', () => {
      const result = normalizeOptions('pkg', 'pkg', {
        main: './src/main.ts',
        tsConfig: './tsconfig.json',
        outputPath: '../dist/pkg',
      });

      expect(result.buildLibsFromSource).toBe(true);
    });

    it('should preserve an explicit false', () => {
      const result = normalizeOptions('pkg', 'pkg', {
        main: './src/main.ts',
        tsConfig: './tsconfig.json',
        outputPath: '../dist/pkg',
        buildLibsFromSource: false,
      });

      expect(result.buildLibsFromSource).toBe(false);
    });

    it('should preserve an explicit true', () => {
      const result = normalizeOptions('pkg', 'pkg', {
        main: './src/main.ts',
        tsConfig: './tsconfig.json',
        outputPath: '../dist/pkg',
        buildLibsFromSource: true,
      });

      expect(result.buildLibsFromSource).toBe(true);
    });
  });

  it('should normalize relative paths', () => {
    const result = normalizeOptions('pkg', 'pkg', {
      main: './src/main.ts',
      additionalEntryPoints: ['./src/worker1.ts', './src/worker2.ts'],
      tsConfig: './tsconfig.json',
      outputPath: '../dist/pkg',
    });

    expect(result).toMatchObject({
      additionalEntryPoints: ['pkg/src/worker1.ts', 'pkg/src/worker2.ts'],
      main: 'pkg/src/main.ts',
      outputPath: 'dist/pkg',
      tsConfig: 'pkg/tsconfig.json',
    });
  });

  it('should normalize relative paths', () => {
    const result = normalizeOptions('pkg', 'pkg', {
      main: './src/main.ts',
      tsConfig: './tsconfig.json',
      outputPath: '../dist/pkg',
      assets: [
        './src/assets',
        { input: './docs', output: '.', glob: '**/*.md' },
      ],
    });

    expect(result).toMatchObject({
      assets: [
        {
          glob: '**/*',
          input: '/tmp/pkg/src/assets',
          output: 'src/assets',
        },
        {
          glob: '**/*.md',
          input: '/tmp/docs',
          output: '.',
        },
      ],
      compiler: 'babel',
      main: 'pkg/src/main.ts',
      outputPath: 'dist/pkg',
      tsConfig: 'pkg/tsconfig.json',
    });
  });

  describe('Windows path handling', () => {
    it('should normalize Windows paths for additionalEntryPoints', () => {
      const windowsPath = './src\\entrypoints\\*.ts';
      const options = {
        main: './src/main.ts',
        additionalEntryPoints: [windowsPath],
        outputPath: '../dist/test-lib',
        tsConfig: './tsconfig.json',
      };

      const result = normalizeOptions(
        'libs/test-lib',
        'libs/test-lib/src',
        options
      );

      expect(result.additionalEntryPoints).toBeDefined();
      result.additionalEntryPoints.forEach((entry) => {
        expect(entry).not.toContain('\\');
        expect(entry).toMatch(/^libs\/test-lib\/src\/entrypoints\/\*\.ts$/);
      });
    });
  });
});
