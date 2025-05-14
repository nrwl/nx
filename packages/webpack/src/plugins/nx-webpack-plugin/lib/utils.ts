import { type ProjectGraphProjectNode } from '@nx/devkit';

function isSourceFile(path: string): boolean {
  return ['.ts', '.tsx', '.mts', '.cts'].some((ext) => path.endsWith(ext));
}

function isBuildableExportMap(packageExports: any): boolean {
  if (!packageExports || Object.keys(packageExports).length === 0) {
    return false; // exports = {} → not buildable
  }

  const isCompiledExport = (value: unknown): boolean => {
    if (typeof value === 'string') {
      return !isSourceFile(value);
    }
    if (typeof value === 'object' && value !== null) {
      return Object.entries(value).some(([key, subValue]) => {
        if (
          key === 'types' ||
          key === 'development' ||
          key === './package.json'
        )
          return false;
        return typeof subValue === 'string' && !isSourceFile(subValue);
      });
    }
    return false;
  };

  if (packageExports['.']) {
    return isCompiledExport(packageExports['.']);
  }

  return Object.entries(packageExports).some(
    ([key, value]) => key !== '.' && isCompiledExport(value)
  );
}

/**
 * Check if the library is buildable.
 * @param node from the project graph
 * @returns boolean
 */
export function isBuildableLibrary(node: ProjectGraphProjectNode): boolean {
  if (!node.data.metadata?.js) {
    return false;
  }
  const { packageExports, packageMain } = node.data.metadata.js;
  // if we have exports only check this else fallback to packageMain
  if (packageExports) {
    return isBuildableExportMap(packageExports);
  }
  return (
    typeof packageMain === 'string' &&
    packageMain !== '' &&
    !isSourceFile(packageMain)
  );
}
