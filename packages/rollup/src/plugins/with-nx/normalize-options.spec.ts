import { normalizeOptions } from './normalize-options';

jest.mock('@nx/js', () => ({
  ...jest.requireActual('@nx/js'),
  createEntryPoints: (x: string) => x,
}));

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  workspaceRoot: '/tmp',
}));

jest.mock('node:fs', () => ({
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
      compiler: 'babel',
      deleteOutputPath: true,
      extractCss: true,
      generateExportsField: false,
      javascriptEnabled: false,
      skipTypeCheck: false,
      skipTypeField: false,
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
});
