import { readNxJson, Tree } from '@nx/devkit';

export function hasDotNetPlugin(tree: Tree): boolean {
  const nxJson = readNxJson(tree);
  return !!nxJson.plugins?.some((p) =>
    typeof p === 'string' ? p === '@nx/dotnet' : p.plugin === '@nx/dotnet'
  );
}
