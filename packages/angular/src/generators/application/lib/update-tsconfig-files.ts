import {
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  updateJson,
  type Tree,
} from '@nx/devkit';
import { getRootTsConfigFileName } from '@nx/js';
import { getNeededCompilerOptionOverrides } from '@nx/js/src/utils/typescript/configuration';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
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
    moduleResolution: 'bundler',
  };

  const rootTsConfigPath = getRootTsConfigFileName(tree);

  const { major: angularMajorVersion, version: angularVersion } =
    getInstalledAngularVersionInfo(tree);
  if (lt(angularVersion, '18.1.0')) {
    compilerOptions.useDefineForClassFields = false;
  }
  if (gte(angularVersion, '18.2.0')) {
    compilerOptions.isolatedModules = true;
  }
  if (gte(angularVersion, '19.1.0')) {
    // Angular started warning about emitDecoratorMetadata and isolatedModules
    // in v19.1.0. If enabled in the root tsconfig, we need to disable it.
    if (shouldDisableEmitDecoratorMetadata(tree, rootTsConfigPath)) {
      compilerOptions.emitDecoratorMetadata = false;
    }
  }
  if (angularMajorVersion >= 20) {
    compilerOptions.module = 'preserve';
  } else {
    compilerOptions.module = 'es2022';
    if (options.bundler === 'esbuild') {
      compilerOptions.esModuleInterop = true;
    }
  }

  const tsconfigPath = joinPathFragments(
    options.appProjectRoot,
    'tsconfig.json'
  );
  updateJson(tree, tsconfigPath, (json) => {
    json.compilerOptions = {
      ...json.compilerOptions,
      ...compilerOptions,
    };
    json.compilerOptions = getNeededCompilerOptionOverrides(
      tree,
      json.compilerOptions,
      rootTsConfigPath
    );
    return json;
  });

  if (options.unitTestRunner === 'jest') {
    const tsconfigSpecPath = joinPathFragments(
      options.appProjectRoot,
      'tsconfig.spec.json'
    );
    updateJson(tree, tsconfigSpecPath, (json) => {
      json.compilerOptions = {
        ...json.compilerOptions,
        module: 'commonjs',
        moduleResolution: 'node10',
      };
      json.compilerOptions = getNeededCompilerOptionOverrides(
        tree,
        json.compilerOptions,
        tsconfigPath
      );
      return json;
    });
  }
}

function updateEditorTsConfig(tree: Tree, options: NormalizedSchema) {
  const tsconfigEditorPath = joinPathFragments(
    options.appProjectRoot,
    'tsconfig.editor.json'
  );
  if (!tree.exists(tsconfigEditorPath)) {
    return;
  }

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

function shouldDisableEmitDecoratorMetadata(
  tree: Tree,
  tsConfigPath: string
): boolean {
  const ts = ensureTypescript();
  const tsSysFromTree: import('typescript').System = {
    ...ts.sys,
    readFile: (path) => tree.read(path, 'utf-8'),
  };

  const parsed = ts.parseJsonConfigFileContent(
    ts.readConfigFile(tsConfigPath, tsSysFromTree.readFile).config,
    tsSysFromTree,
    tree.root
  );

  return parsed.options.emitDecoratorMetadata === true;
}
