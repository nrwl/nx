import { readJsonFile, workspaceRoot } from '@nx/devkit';
import { createConformanceRule } from '@nx/powerpack-conformance';
import type { Violation } from '@nx/powerpack-conformance/src/reporters/project-files-reporter';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export default createConformanceRule<object>({
  name: 'project-package-json',
  category: 'consistency',
  description:
    'Ensures consistency across our project package.json files within the Nx repo',
  reporter: 'project-files-reporter',
  implementation: async ({ projectGraph }) => {
    const violations: Violation[] = [];

    for (const project of Object.values(projectGraph.nodes)) {
      const projectPackageJsonPath = join(
        workspaceRoot,
        project.data.root,
        'package.json'
      );
      if (existsSync(projectPackageJsonPath)) {
        const projectPackageJson = readJsonFile(projectPackageJsonPath);
        violations.push(
          ...validateProjectPackageJson(
            projectPackageJson,
            project.name,
            project.data.root,
            projectPackageJsonPath
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

export function validateProjectPackageJson(
  projectPackageJson: Record<string, unknown>,
  sourceProject: string,
  sourceProjectRoot: string,
  projectPackageJsonPath: string
): Violation[] {
  const violations: Violation[] = [];

  if (typeof projectPackageJson.name !== 'string') {
    violations.push({
      message: 'The project package.json should have a "name" field',
      sourceProject,
      file: projectPackageJsonPath,
    });
  } else {
    // Ensure that if a scope is used, it is only the @nx scope
    if (
      projectPackageJson.name.startsWith('@') &&
      !projectPackageJson.name.startsWith('@nx/')
    ) {
      violations.push({
        message: 'The package name should be scoped to the @nx org',
        sourceProject,
        file: projectPackageJsonPath,
      });
    }
  }

  // Public packages
  if (!projectPackageJson.private) {
    if ((projectPackageJson.publishConfig as any)?.access !== 'public') {
      violations.push({
        message:
          'Public packages should have "publishConfig": { "access": "public" } set in their package.json',
        sourceProject,
        file: projectPackageJsonPath,
      });
    }
  }

  // Nx config properties
  if (existsSync(join(sourceProjectRoot, 'executors.json'))) {
    if (projectPackageJson.executors !== './executors.json') {
      violations.push({
        message:
          'The project has an executors.json, but does not reference "./executors.json" in the "executors" field of its package.json',
        sourceProject,
        file: projectPackageJsonPath,
      });
    }
  }
  if (existsSync(join(sourceProjectRoot, 'generators.json'))) {
    if (projectPackageJson.generators !== './generators.json') {
      violations.push({
        message:
          'The project has an generators.json, but does not reference "./generators.json" in the "generators" field of its package.json',
        sourceProject,
        file: projectPackageJsonPath,
      });
    }
  }

  return violations;
}
