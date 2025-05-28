import {
  generateFiles,
  joinPathFragments,
  offsetFromRoot,
  readJson,
  readProjectConfiguration,
  updateJson,
  type Tree,
} from '@nx/devkit';
import { join } from 'path';
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

    const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);

    const files = new Set(json.files ?? []);
    files.add(joinPathFragments('src', options.main));
    if (angularMajorVersion >= 19) {
      files.add(joinPathFragments('src', options.serverFileName));
    } else {
      files.add(joinPathFragments(options.serverFileName));
    }
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
  } else if (angularMajorVersion === 19) {
    pathToFiles = join(baseFilesPath, 'v19', 'server-builder', 'root');
  } else {
    pathToFiles = join(baseFilesPath, 'pre-v19', 'root');
  }

  generateFiles(tree, pathToFiles, project.root, {
    ...options,
    rootOffset: offsetFromRoot(project.root),
    hasLocalizePackage,
    tpl: '',
  });

  updateJson(tree, joinPathFragments(project.root, 'tsconfig.json'), (json) => {
    json.references ??= [];
    json.references.push({
      path: joinPathFragments(project.root, 'tsconfig.server.json'),
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
}
