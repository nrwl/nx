import {
  generateFiles,
  joinPathFragments,
  offsetFromRoot,
  readJson,
  readProjectConfiguration,
  updateJson,
  type Tree,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { join } from 'path';
import { readCompilerOptionsFromTsConfig } from '../../utils/tsconfig-utils';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { NormalizedGeneratorOptions } from '../schema';

export function setServerTsConfigOptionsForApplicationBuilder(
  tree: Tree,
  options: NormalizedGeneratorOptions
) {
  const { targets } = readProjectConfiguration(tree, options.project);
  const tsConfigPath = targets.build.options.tsConfig;

  updateJson(tree, tsConfigPath, (json) => {
    json.compilerOptions ??= {};
    const types = new Set(json.compilerOptions.types ?? []);
    types.add('node');
    json.compilerOptions.types = Array.from(types);

    if (json.include?.includes('src/**/*.ts')) {
      // server file is already included, no need to add it
      return json;
    }

    const files = new Set(json.files ?? []);
    files.add(joinPathFragments('src', options.main));
    files.add(joinPathFragments('src', options.serverFileName));
    json.files = Array.from(files);

    return json;
  });
}

export function generateTsConfigServerJsonForBrowserBuilder(
  tree: Tree,
  options: NormalizedGeneratorOptions
) {
  const project = readProjectConfiguration(tree, options.project);

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);

  const packageJson = readJson(tree, 'package.json');
  const hasLocalizePackage =
    !!packageJson.dependencies?.['@angular/localize'] ||
    !!packageJson.devDependencies?.['@angular/localize'];

  const baseFilesPath = join(__dirname, '..', 'files');
  let pathToFiles: string;
  if (angularMajorVersion >= 20) {
    pathToFiles = join(baseFilesPath, 'v20+', 'server-builder', 'root');
  } else {
    pathToFiles = join(baseFilesPath, 'v19', 'server-builder', 'root');
  }

  generateFiles(tree, pathToFiles, project.root, {
    ...options,
    rootOffset: offsetFromRoot(project.root),
    hasLocalizePackage,
    tpl: '',
  });

  const tsconfigServerPath = joinPathFragments(
    project.root,
    'tsconfig.server.json'
  );
  updateJson(tree, joinPathFragments(project.root, 'tsconfig.json'), (json) => {
    json.references ??= [];
    json.references.push({
      path: tsconfigServerPath,
    });
    return json;
  });

  if (angularMajorVersion >= 20) {
    updateJson(tree, options.buildTargetTsConfigPath, (json) => {
      const exclude = new Set(json.exclude ?? []);
      exclude.add(`src/${options.main}`);
      exclude.add(`src/${options.serverFileName}`);
      if (options.standalone) {
        exclude.add('src/app/app.config.server.ts');
      }
      json.exclude = Array.from(exclude);
      return json;
    });
  }
  if (angularMajorVersion >= 21) {
    // remove module and moduleResolution from tsconfig.server.json
    updateJson(tree, tsconfigServerPath, (json) => {
      delete json.compilerOptions.module;
      delete json.compilerOptions.moduleResolution;
      return json;
    });

    // read the parsed compiler options from tsconfig.server.json
    const compilerOptions = readCompilerOptionsFromTsConfig(
      tree,
      tsconfigServerPath
    );

    const ts = ensureTypescript();
    if (
      compilerOptions.module === ts.ModuleKind.Preserve &&
      compilerOptions.moduleResolution === ts.ModuleResolutionKind.Bundler
    ) {
      return;
    }

    updateJson(tree, tsconfigServerPath, (json) => {
      json.compilerOptions.module = 'preserve';
      json.compilerOptions.moduleResolution = 'bundler';
      return json;
    });
  }
}
