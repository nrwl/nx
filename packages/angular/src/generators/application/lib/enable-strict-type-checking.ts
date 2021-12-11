import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import { updateJson } from '@nrwl/devkit';

export function enableStrictTypeChecking(
  host: Tree,
  options: NormalizedSchema
) {
  const configFiles = [
    `${options.appProjectRoot}/tsconfig.json`,
    `${options.e2eProjectRoot}/tsconfig.json`,
  ];

  for (const configFile of configFiles) {
    if (!host.exists(configFile)) {
      continue;
    }

    // Update the settings in the tsconfig.app.json to enable strict type checking.
    // This matches the settings defined by the Angular CLI https://angular.io/guide/strict-mode
    updateJson(host, configFile, (json) => {
      // update the TypeScript settings
      json.compilerOptions = {
        ...(json.compilerOptions ?? {}),
        forceConsistentCasingInFileNames: true,
        strict: true,
        noImplicitOverride: true,
        noPropertyAccessFromIndexSignature: true,
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
}
