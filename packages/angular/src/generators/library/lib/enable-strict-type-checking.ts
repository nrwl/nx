import type { Tree } from '@nrwl/devkit';
import {
  updateWorkspaceConfiguration,
  readWorkspaceConfiguration,
  updateJson,
} from '@nrwl/devkit';
import { NormalizedSchema } from './normalized-schema';

/**
 * Enable Strict Mode in the library and spec TS Config
 * */
export function enableStrictTypeChecking(
  host: Tree,
  options: NormalizedSchema
) {
  updateTsConfig(host, options);
}

export function setLibraryStrictDefault(host: Tree, isStrict: boolean) {
  // set the default so future libraries use it
  // unless the user has previously set this value
  const workspace = readWorkspaceConfiguration(host);

  workspace.generators = workspace.generators || {};

  workspace.generators['@nrwl/angular:library'] =
    workspace.generators['@nrwl/angular:library'] || {};

  workspace.generators['@nrwl/angular:library'].strict =
    workspace.generators['@nrwl/angular:library'].strict ?? isStrict;
  updateWorkspaceConfiguration(host, workspace);
}

function updateTsConfig(host: Tree, options: NormalizedSchema) {
  // Update the settings in the tsconfig.app.json to enable strict type checking.
  // This matches the settings defined by the Angular CLI https://angular.io/guide/strict-mode
  updateJson(host, `${options.projectRoot}/tsconfig.json`, (json) => {
    // update the TypeScript settings
    json.compilerOptions = {
      ...(json.compilerOptions ?? {}),
      forceConsistentCasingInFileNames: true,
      strict: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,
    };

    // update Angular Template Settings
    json.angularCompilerOptions = {
      ...(json.angularCompilerOptions ?? {}),
      strictInjectionParameters: true,
      strictInputAccessModifiers: true,
      strictTemplates: true,
    };

    return json;
  });
}
