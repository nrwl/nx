import { resolveInstalledPackage } from '@nx/devkit/internal';

export function resolveOptionalModule(
  request: string,
  directory: string
): string | null {
  try {
    return resolveInstalledPackage(request, [directory], directory);
  } catch {
    return null;
  }
}
