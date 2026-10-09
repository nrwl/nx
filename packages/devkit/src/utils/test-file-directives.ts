import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TargetConfiguration } from 'nx/src/devkit-exports';
import {
  parseNxDependsOnDirective,
  scopeTestTargetToProjects,
  withoutServerInputs,
} from './test-file-depends-on';
import { parseUltracacheImportsDirective } from './ultracache-directive';

/**
 * `target` with the `@nx-*` directives of a workspace-relative test file
 * applied. Throws when `@nx-depends-on` lists no projects or an
 * `@nx-ultracache` value is unsupported.
 */
export function applyTestFileDirectives(
  target: TargetConfiguration,
  workspaceRoot: string,
  file: string
): TargetConfiguration {
  const content = readFileSync(join(workspaceRoot, file), 'utf-8');
  const projects = parseNxDependsOnDirective(content);
  if (projects?.length === 0) {
    throw new Error(
      `${file}: "@nx-depends-on:" must list the projects the test depends on, separated by commas.`
    );
  }
  const hashesFromImports = parseUltracacheImportsDirective(content, file);
  const scoped = projects
    ? scopeTestTargetToProjects(target, projects)
    : target;
  return hashesFromImports && scoped.dependsOn
    ? { ...scoped, dependsOn: withoutServerInputs(scoped.dependsOn) }
    : scoped;
}
