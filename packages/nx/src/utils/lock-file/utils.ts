import { ProjectGraph } from 'nx/src/config/project-graph';
import { defaultHashing } from '../../hasher/hashing-impl';

/**
 * Simple sort function to ensure keys are ordered alphabetically
 * @param obj
 * @returns
 */
export function sortObject<T = string>(
  obj: Record<string, T>,
  valueTransformator: (value: T) => any = (value) => value
): Record<string, T> | undefined {
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return;
  }

  const result: Record<string, T> = {};
  keys.sort().forEach((key) => {
    result[key] = valueTransformator(obj[key]);
  });
  return result;
}

export function hashString(fileContent: string): string {
  return defaultHashing.hashArray([fileContent]);
}

export function getProjectExternalDependencies(
  projectName: string,
  projectGraph: ProjectGraph
): string[] {
  const deps = [];
  projectGraph.dependencies[projectName].forEach((d) => {
    if (d.target.startsWith('npm:')) {
      const externalPackage = d.target.substring(4);
      if (deps.indexOf(externalPackage) === -1) {
        deps.push(externalPackage);
      }
    }
  });
  return deps;
}
