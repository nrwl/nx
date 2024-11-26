import { Tree, writeJson } from '@nx/devkit';
import * as shared from '@nx/js/src/utils/typescript/create-ts-config';

export function createTsConfig(
  host: Tree,
  options: {
    projectRoot: string;
    rootProject?: boolean;
    unitTestRunner?: string;
  },
  relativePathToRootTsConfig: string
) {
  createAppTsConfig(host, options);
  const json = {
    compilerOptions: {},
    files: [],
    include: ['.nuxt/nuxt.d.ts'],
    references: [
      {
        path: './tsconfig.app.json',
      },
    ],
  } as any;

  if (options.unitTestRunner !== 'none') {
    json.references.push({
      path: './tsconfig.spec.json',
    });
  }

  // inline tsconfig.base.json into the project
  if (options.rootProject) {
    json.compileOnSave = false;
    json.compilerOptions = {
      ...shared.tsConfigBaseOptions,
      ...json.compilerOptions,
    };
    json.exclude = ['node_modules', 'tmp'];
  } else {
    json.extends = relativePathToRootTsConfig;
  }

  writeJson(host, `${options.projectRoot}/tsconfig.json`, json);
}

function createAppTsConfig(host: Tree, options: { projectRoot: string }) {
  const json = {
    extends: './tsconfig.json',
    compilerOptions: {
      composite: true,
    },
    include: ['.nuxt/nuxt.d.ts', 'src/**/*'],
    exclude: [],
  };

  writeJson(host, `${options.projectRoot}/tsconfig.app.json`, json);
}
