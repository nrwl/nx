import type { Tree } from '@nx/devkit';
import { writeJson } from '@nx/devkit';
import { tsConfigBaseOptions } from '@nx/js';

export { extractTsConfigBase } from '@nx/js';

export function createTsConfig(
  host: Tree,
  projectRoot: string,
  type: 'app' | 'lib',
  options: {
    strict?: boolean;
    style?: string;
    bundler?: string;
    rootProject?: boolean;
    esModuleInterop?: boolean;
  },
  relativePathToRootTsConfig: string
) {
  const json = {
    compilerOptions: {
      target: 'es2022',
      useDefineForClassFields: false,
      esModuleInterop: options.esModuleInterop ? true : undefined,
    },
    files: [],
    include: [],
    references: [
      {
        path: type === 'app' ? './tsconfig.app.json' : './tsconfig.lib.json',
      },
    ],
  } as any;

  // inline tsconfig.base.json into the project
  if (options.rootProject) {
    json.compileOnSave = false;
    json.compilerOptions = { ...tsConfigBaseOptions, ...json.compilerOptions };
    json.exclude = ['node_modules', 'tmp'];
  } else {
    json.extends = relativePathToRootTsConfig;
  }

  writeJson(host, `${projectRoot}/tsconfig.json`, json);
}
