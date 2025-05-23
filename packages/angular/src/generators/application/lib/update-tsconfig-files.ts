import {
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  updateJson,
  type Tree,
} from '@nx/devkit';
import { getRootTsConfigFileName } from '@nx/js';
import { getNeededCompilerOptionOverrides } from '@nx/js/src/utils/typescript/configuration';
import { gte, lt } from 'semver';
import { updateAppEditorTsConfigExcludedFiles } from '../../utils/update-app-editor-tsconfig-excluded-files';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import { enableStrictTypeChecking } from './enable-strict-type-checking';
import type { NormalizedSchema } from './normalized-schema';

interface TsConfig {
  compilerOptions?: Record<string, any>;
  exclude?: string[];
  extends?: string | string[];
  references?: { path: string }[];
}

export function updateTsconfigFiles(tree: Tree, options: NormalizedSchema) {
  enableStrictTypeChecking(tree, options);
  updateEditorTsConfig(tree, options);

  const compilerOptions: Record<string, any> = {
    skipLibCheck: true,
    experimentalDecorators: true,
    importHelpers: true,
    target: 'es2022',
  };

  const { major: angularMajorVersion, version: angularVersion } =
    getInstalledAngularVersionInfo(tree);
  if (lt(angularVersion, '18.1.0')) {
    compilerOptions.useDefineForClassFields = false;
  }
  if (gte(angularVersion, '18.2.0')) {
    compilerOptions.isolatedModules = true;
  }
  if (angularMajorVersion >= 20) {
    compilerOptions.module = 'preserve';
  } else {
    compilerOptions.moduleResolution = 'bundler';
    compilerOptions.module = 'es2022';
    if (options.bundler === 'esbuild') {
      compilerOptions.esModuleInterop = true;
    }
  }

  updateJson(tree, `${options.appProjectRoot}/tsconfig.json`, (json) => {
    json.compilerOptions = {
      ...json.compilerOptions,
      ...compilerOptions,
    };
    json.compilerOptions = getNeededCompilerOptionOverrides(
      tree,
      json.compilerOptions,
      getRootTsConfigFileName(tree)
    );
    return json;
  });
}

function updateEditorTsConfig(tree: Tree, options: NormalizedSchema) {
  const appTsConfig = readJson<TsConfig>(
    tree,
    joinPathFragments(options.appProjectRoot, 'tsconfig.app.json')
  );
  const types = appTsConfig?.compilerOptions?.types ?? [];

  if (types?.length) {
    updateJson(
      tree,
      joinPathFragments(options.appProjectRoot, 'tsconfig.editor.json'),
      (json) => {
        json.compilerOptions ??= {};
        json.compilerOptions.types = Array.from(new Set(types));
        return json;
      }
    );
  }

  const project = readProjectConfiguration(tree, options.name);
  updateAppEditorTsConfigExcludedFiles(tree, project);
}
