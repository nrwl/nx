import {
  createConformanceRule,
  type ConformanceViolation,
} from '@nx/conformance';
import { readJsonFile, workspaceRoot } from '@nx/devkit';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { satisfies } from 'semver';

type Options = {
  groups: Array<string[]>;
  versionRange?: string;
};

export default createConformanceRule<Options>({
  name: 'migration-groups',
  category: 'consistency',
  description:
    'Ensures that packageJsonUpdates in migrations.json have all packages included from groups. e.g. @typescript-eslint/* packages must be in sync',
  implementation: async ({ projectGraph, ruleOptions }) => {
    const violations: ConformanceViolation[] = [];

    for (const project of Object.values(projectGraph.nodes)) {
      if (
        project.name !== 'angular' &&
        project.name !== 'eslint' &&
        project.name !== 'storybook'
      )
        continue;
      const migrationsPath = join(
        workspaceRoot,
        project.data.root,
        'migrations.json'
      );
      if (existsSync(migrationsPath)) {
        const migrations = readJsonFile(migrationsPath);
        violations.push(
          ...validateMigrations(
            migrations,
            project.name,
            migrationsPath,
            ruleOptions
          )
        );
      }
    }

    return {
      severity: 'high',
      details: {
        violations,
      },
    };
  },
});

export function validateMigrations(
  migrations: Record<string, unknown>,
  sourceProject: string,
  migrationsPath: string,
  options: Options
): ConformanceViolation[] {
  if (!migrations.packageJsonUpdates) return [];

  const violations: ConformanceViolation[] = [];

  // Check that if package updates include one package in the group, then:
  // 1. They all have the same version
  // 2. Every package from group is included
  for (const [key, value] of Object.entries(migrations.packageJsonUpdates)) {
    if (!value.packages || !value.version) continue;
    if (
      options.versionRange &&
      !satisfies(value.version, options.versionRange, {
        includePrerelease: true,
      })
    )
      continue;
    const packages = Object.keys(value.packages);
    for (const group of options.groups) {
      if (!group.some((pkg) => packages.includes(pkg))) continue;

      const versions = new Set<string>(
        group.map((pkg) => value.packages[pkg]?.version).filter(Boolean)
      );
      if (versions.size > 1) {
        violations.push({
          message: `Package.json updates for "${key}" has mismatched versions in a package group: ${Array.from(
            versions
          ).join(
            ', '
          )}. Versions of packages in a group must be in sync. Packages in the group: ${group.join(
            ', '
          )}`,
          sourceProject,
          file: migrationsPath,
        });
      }

      const result = group.reduce(
        (acc, pkg) => {
          if (packages.includes(pkg)) acc.present.push(pkg);
          else acc.missing.push(pkg);
          return acc;
        },
        { missing: [] as string[], present: [] as string[] }
      );
      if (result.missing.length > 0) {
        violations.push({
          message: `Package.json updates for "${key}" is missing packages in a group: ${result.missing.join(
            ', '
          )}. Versions of packages in a group must have their versions synced. ${
            versions.size === 1
              ? `Version: ${Array.from(versions)[0]}.`
              : `Versions: ${Array.from(versions).join(',')} (choose one).`
          }
            `,
          sourceProject,
          file: migrationsPath,
        });
      }
    }
  }

  return violations;
}
