import { ProjectConfiguration } from '../src/config/workspace-json-project-json.js';
export type PackageJsonConfigurationCache = {
  [hash: string]: ProjectConfiguration;
};
export declare function readPackageJsonConfigurationCache(): PackageJsonConfigurationCache;
//# sourceMappingURL=package-json.d.ts.map
