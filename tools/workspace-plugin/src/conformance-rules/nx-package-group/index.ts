import {
  createConformanceRule,
  type ConformanceViolation,
} from '@nx/conformance';
import { readJsonFile, workspaceRoot } from '@nx/devkit';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export default createConformanceRule({
  name: 'nx-package-group',
  category: 'consistency',
  description:
    'Ensures every published @nx/* plugin is listed in the nx package group so that "nx migrate" bumps it together with nx',
  implementation: async ({ projectGraph }) => {
    const nxPackageJsonPath = join(workspaceRoot, 'packages/nx/package.json');
    const nxPackageJson = readJsonFile(nxPackageJsonPath);
    const packageGroup = new Set<string>(
      (nxPackageJson['nx-migrations']?.packageGroup ?? []).map(
        (entry: string | { package: string }) =>
          typeof entry === 'string' ? entry : entry.package
      )
    );

    const violations: ConformanceViolation[] = [];
    for (const project of Object.values(projectGraph.nodes)) {
      // Plugins live directly at packages/<name>. Deeper roots (the native
      // platform packages under packages/nx/native-packages) are published
      // under @nx/* but are versioned by nx itself, not by "nx migrate".
      if (!/^packages\/[^/]+$/.test(project.data.root)) {
        continue;
      }
      const packageJsonPath = join(
        workspaceRoot,
        project.data.root,
        'package.json'
      );
      if (!existsSync(packageJsonPath)) {
        continue;
      }
      violations.push(
        ...validatePackageGroupMembership(
          readJsonFile(packageJsonPath),
          project.name,
          nxPackageJsonPath,
          packageGroup
        )
      );
    }

    return {
      severity: 'high',
      details: {
        violations,
      },
    };
  },
});

export function validatePackageGroupMembership(
  packageJson: { name?: string; private?: boolean },
  sourceProject: string,
  nxPackageJsonPath: string,
  packageGroup: Set<string>
): ConformanceViolation[] {
  if (packageJson.private) {
    return [];
  }
  if (!packageJson.name?.startsWith('@nx/')) {
    return [];
  }
  if (packageGroup.has(packageJson.name)) {
    return [];
  }
  return [
    {
      sourceProject,
      file: nxPackageJsonPath,
      message: `${packageJson.name} is missing from the "nx-migrations".packageGroup in packages/nx/package.json, so "nx migrate" will not update it together with the other Nx packages. Add it to the group.`,
    },
  ];
}
