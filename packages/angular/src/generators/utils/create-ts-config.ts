import type { Tree } from '@nrwl/devkit';
import { writeJson } from '@nrwl/devkit';
import { tsConfigBaseOptions } from '@nrwl/js';
import { getInstalledAngularMajorVersion } from './version-utils';

export { extractTsConfigBase } from '@nrwl/js';

export function createTsConfig(
  host: Tree,
  projectRoot: string,
  type: 'app' | 'lib',
  options: {
    strict?: boolean;
    style?: string;
    bundler?: string;
    rootProject?: boolean;
  },
  relativePathToRootTsConfig: string
) {
  const majorAngularVersion = getInstalledAngularMajorVersion(host);

  const json = {
    compilerOptions: {
      target: majorAngularVersion === 14 ? 'es2020' : 'es2022',
      useDefineForClassFields: false,
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
