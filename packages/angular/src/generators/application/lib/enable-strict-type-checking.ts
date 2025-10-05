import type { Tree } from '@nx/devkit';
import { updateJson } from '@nx/devkit';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { NormalizedSchema } from './normalized-schema';

export function enableStrictTypeChecking(
  host: Tree,
  options: NormalizedSchema
): void {
  // This matches the settings defined by the Angular CLI https://angular.io/guide/strict-mode
  const compilerOptions = {
    strict: true,
    noImplicitOverride: true,
    noPropertyAccessFromIndexSignature: true,
    noImplicitReturns: true,
    noFallthroughCasesInSwitch: true,
  };

  const appTsConfigPath = `${options.appProjectRoot}/tsconfig.json`;
  if (host.exists(appTsConfigPath)) {
    const { major: angularMajorVersion } = getInstalledAngularVersionInfo(host);

    updateJson(host, appTsConfigPath, (json) => {
      json.compilerOptions = { ...json.compilerOptions, ...compilerOptions };
      json.angularCompilerOptions = {
        ...json.angularCompilerOptions,
        strictInjectionParameters: true,
        strictInputAccessModifiers: true,
        typeCheckHostBindings: angularMajorVersion >= 20 ? true : undefined,
        strictTemplates: true,
      };
      return json;
    });
  }

  const e2eTsConfigPath = `${options.e2eProjectRoot}/tsconfig.json`;
  if (host.exists(e2eTsConfigPath)) {
    updateJson(host, e2eTsConfigPath, (json) => {
      json.compilerOptions = { ...json.compilerOptions, ...compilerOptions };
      return json;
    });
  }
}
