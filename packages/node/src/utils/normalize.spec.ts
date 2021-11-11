import { normalizeBuildOptions } from './normalize';
import { BuildNodeBuilderOptions } from './types';

import * as fs from 'fs';

describe('normalizeBuildOptions', () => {
  let testOptions: BuildNodeBuilderOptions;
  let root: string;
  let sourceRoot: string;
  let projectRoot: string;

  beforeEach(() => {
    testOptions = {
      main: 'apps/nodeapp/src/main.ts',
      tsConfig: 'apps/nodeapp/tsconfig.app.json',
      outputPath: 'dist/apps/nodeapp',
      fileReplacements: [
        {
          replace: 'apps/environment/environment.ts',
          with: 'apps/environment/environment.prod.ts',
        },
        {
          replace: 'module1.ts',
          with: 'module2.ts',
        },
      ],
      assets: [],
      statsJson: false,
      externalDependencies: 'all',
    };
    root = '/root';
    sourceRoot = 'apps/nodeapp/src';
    projectRoot = 'apps/nodeapp';
  });
  it('should add the root', () => {
    const result = normalizeBuildOptions(
      testOptions,
      root,
      sourceRoot,
      projectRoot
    );
    expect(result.root).toEqual('/root');
  });

  it('should resolve main from root', () => {
    const result = normalizeBuildOptions(
      testOptions,
      root,
      sourceRoot,
      projectRoot
    );
    expect(result.main).toEqual('/root/apps/nodeapp/src/main.ts');
  });

  it('should resolve additional entries from root', () => {
    const result = normalizeBuildOptions(
      {
        ...testOptions,
        additionalEntryPoints: [
          { entryName: 'test', entryPath: 'some/path.ts' },
        ],
      },
      root,
      sourceRoot,
      projectRoot
    );
    expect(result.additionalEntryPoints[0].entryPath).toEqual(
      '/root/some/path.ts'
    );
  });

  it('should resolve the output path', () => {
    const result = normalizeBuildOptions(
      testOptions,
      root,
      sourceRoot,
      projectRoot
    );
    expect(result.outputPath).toEqual('/root/dist/apps/nodeapp');
  });

  it('should resolve the tsConfig path', () => {
    const result = normalizeBuildOptions(
      testOptions,
      root,
      sourceRoot,
      projectRoot
    );
    expect(result.tsConfig).toEqual('/root/apps/nodeapp/tsconfig.app.json');
  });

  it('should normalize asset patterns', () => {
    jest.spyOn(fs, 'statSync').mockReturnValue({
      isDirectory: () => true,
    } as any);
    const result = normalizeBuildOptions(
      {
        ...testOptions,
        root,
        assets: [
          'apps/nodeapp/src/assets',
          {
            input: 'outsideproj',
            output: 'output',
            glob: '**/*',
            ignore: ['**/*.json'],
          },
        ],
      },
      root,
      sourceRoot,
      projectRoot
    );
    expect(result.assets).toEqual([
      {
        input: '/root/apps/nodeapp/src/assets',
        output: 'assets',
        glob: '**/*',
      },
      {
        input: '/root/outsideproj',
        output: 'output',
        glob: '**/*',
        ignore: ['**/*.json'],
      },
    ]);
  });

  it('should resolve the file replacement paths', () => {
    const result = normalizeBuildOptions(
      testOptions,
      root,
      sourceRoot,
      projectRoot
    );
    expect(result.fileReplacements).toEqual([
      {
        replace: '/root/apps/environment/environment.ts',
        with: '/root/apps/environment/environment.prod.ts',
      },
      {
        replace: '/root/module1.ts',
        with: '/root/module2.ts',
      },
    ]);
  });

  it('should resolve outputFileName correctly', () => {
    const result = normalizeBuildOptions(
      testOptions,
      root,
      sourceRoot,
      projectRoot
    );
    expect(result.outputFileName).toEqual('main.js');
  });

  it('should resolve outputFileName to "main.js" if not passed in', () => {
    const result = normalizeBuildOptions(
      { ...testOptions, outputFileName: 'index.js' },
      root,
      sourceRoot,
      projectRoot
    );
    expect(result.outputFileName).toEqual('index.js');
  });
});
