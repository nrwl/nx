import { readModulePackageJson } from '@nx/devkit/internal';

export function readRuntimeDependencies(
  runtimeDependencies: string[],
  requirePaths: string[]
): Record<string, string> {
  const dependencies: Record<string, string> = {};
  for (const dependency of runtimeDependencies) {
    const { name, version } = readModulePackageJson(
      dependency,
      requirePaths
    ).packageJson;
    // An alias installs `name` in the folder `dependency`, which `require` loads.
    dependencies[dependency] =
      name === dependency ? version : `npm:${name}@${version}`;
  }
  return dependencies;
}
