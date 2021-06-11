import { NormalizedSchema } from './normalized-schema';
import { Rule } from '@angular-devkit/schematics';
import { updateJsonInTree, updateWorkspace } from '@nrwl/workspace';

/**
 * Enable Strict Mode in the library and spec TS Config
 * */
export function enableStrictTypeChecking(options: NormalizedSchema): Rule {
  return () => updateTsConfig(options);
}

export function setLibraryStrictDefault(strict: boolean): Rule {
  // set the default so future libraries use it
  // unless the user has previously set this value
  return updateWorkspace((workspace) => {
    workspace.extensions.schematics = workspace.extensions.schematics || {};

    workspace.extensions.schematics['@nrwl/angular:library'] =
      workspace.extensions.schematics['@nrwl/angular:library'] || {};

    workspace.extensions.schematics['@nrwl/angular:library'].strict =
      workspace.extensions.schematics['@nrwl/angular:library'].strict ?? strict;
  });
}

function updateTsConfig(options: NormalizedSchema): Rule {
  return () => {
    // Update the settings in the tsconfig.app.json to enable strict type checking.
    // This matches the settings defined by the Angular CLI https://angular.io/guide/strict-mode
    return updateJsonInTree(`${options.projectRoot}/tsconfig.json`, (json) => {
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
  };
}
