import { readJsonFile, workspaceRoot } from '@nx/devkit';
import {
  createConformanceRule,
  type ProjectFilesViolation,
} from '@nx/conformance';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export default createConformanceRule<object>({
  name: 'project-package-json',
  category: 'consistency',
  description:
    'Ensures consistency across our project package.json files within the Nx repo',
  reporter: 'project-files-reporter',
  implementation: async ({ projectGraph }) => {
    const violations: ProjectFilesViolation[] = [];

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
): ProjectFilesViolation[] {
  const violations: ProjectFilesViolation[] = [];

  // Private packages are exempt from this rule
  if (projectPackageJson.private === true) {
    return [];
  }

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

  // Publish config
  if ((projectPackageJson.publishConfig as any)?.access !== 'public') {
    violations.push({
      message:
        'Public packages should have "publishConfig": { "access": "public" } set in their package.json',
      sourceProject,
      file: projectPackageJsonPath,
    });
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

  const hasExportsEntries =
    typeof projectPackageJson.exports === 'object' &&
    Object.keys(projectPackageJson.exports ?? {}).length > 0;

  if (!hasExportsEntries) {
    violations.push({
      message:
        'The project package.json should have an "exports" object specified',
      sourceProject,
      file: projectPackageJsonPath,
    });
  }

  return violations;
}
