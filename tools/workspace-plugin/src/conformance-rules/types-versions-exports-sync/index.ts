import {
  createConformanceRule,
  type ConformanceViolation,
} from '@nx/conformance';
import { readJsonFile, workspaceRoot } from '@nx/devkit';
import { existsSync } from 'fs';
import { join } from 'node:path';

export default createConformanceRule<object>({
  name: 'types-versions-exports-sync',
  category: 'consistency',
  description:
    'Ensures every "exports" entry with a "types" condition has a matching "typesVersions" entry and vice versa',
  implementation: async ({ projectGraph }) => {
    const violations: ConformanceViolation[] = [];

    for (const project of Object.values(projectGraph.nodes)) {
      const packageJsonPath = join(
        workspaceRoot,
        project.data.root,
        'package.json'
      );
      if (existsSync(packageJsonPath)) {
        const packageJson = readJsonFile(packageJsonPath);
        violations.push(
          ...validateTypesVersionsExportsSync(
            packageJson,
            project.name,
            packageJsonPath
          )
        );
      }
    }

    return {
      severity: 'medium',
      details: {
        violations,
      },
    };
  },
});

function normalizePath(p: string): string {
  return p.replace(/^\.\//, '');
}

export function validateTypesVersionsExportsSync(
  packageJson: Record<string, unknown>,
  sourceProject: string,
  packageJsonPath: string
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];

  const typesVersions = packageJson.typesVersions as
    | Record<string, Record<string, string[]>>
    | undefined;
  const exports = packageJson.exports as Record<string, unknown> | undefined;

  if (!typesVersions || !exports) {
    return [];
  }

  const tvMap = typesVersions['*'];
  if (!tvMap) {
    return [];
  }

  // Check 1: exports entries with "types" that are missing from typesVersions
  for (const [exportKey, exportValue] of Object.entries(exports)) {
    if (typeof exportValue === 'string') {
      continue;
    }

    if (typeof exportValue !== 'object' || exportValue === null) {
      continue;
    }

    const typesPath = (exportValue as Record<string, string>)['types'];
    if (!typesPath) {
      continue;
    }

    // Skip the root "." entry — typesVersions doesn't map the root
    if (exportKey === '.') {
      continue;
    }

    const subpath = normalizePath(exportKey);
    const normalizedTypesPath = normalizePath(typesPath);

    const tvEntry = tvMap[subpath];
    if (!tvEntry) {
      violations.push({
        message: `The exports entry './${subpath}' has a 'types' condition but no corresponding 'typesVersions' entry. Add '${subpath}' to 'typesVersions' to support node10 module resolution.`,
        sourceProject,
        file: packageJsonPath,
      });
      continue;
    }

    const tvPath = tvEntry[0];
    if (tvPath !== normalizedTypesPath) {
      violations.push({
        message: `The 'typesVersions' entry '${subpath}' maps to '${tvPath}' but 'exports' maps types to '${normalizedTypesPath}'. These must match.`,
        sourceProject,
        file: packageJsonPath,
      });
    }
  }

  // Check 2: stale typesVersions entries with no matching export
  for (const tvKey of Object.keys(tvMap)) {
    const exportKey = `./${tvKey}`;
    const exportValue = exports[exportKey];

    if (
      exportValue &&
      typeof exportValue === 'object' &&
      (exportValue as Record<string, string>)['types']
    ) {
      continue;
    }

    violations.push({
      message: `The 'typesVersions' entry '${tvKey}' has no corresponding 'exports' entry with a 'types' condition. Remove it from 'typesVersions' or add a matching export with a 'types' condition.`,
      sourceProject,
      file: packageJsonPath,
    });
  }

  return violations;
}
