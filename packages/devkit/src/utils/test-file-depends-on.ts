import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  TargetConfiguration,
  TargetDependencyConfig,
} from 'nx/src/devkit-exports';
import { parseNxDirectives } from './nx-directives';

/**
 * The projects a leading `// @nx-depends-on: a, b` comment names, or
 * `undefined` without one. Only the comment block that opens the file is read.
 */
export function parseNxDependsOnDirective(
  content: string
): string[] | undefined {
  const values = parseNxDirectives(content).get('depends-on');
  if (values === undefined) {
    return undefined;
  }
  const projects = new Set<string>();
  for (const value of values) {
    for (const project of value.split(',')) {
      const name = project.trim();
      if (name) {
        projects.add(name);
      }
    }
  }
  return [...projects];
}

/**
 * The `@nx-depends-on` projects of a workspace-relative test file. Throws when
 * the directive lists none.
 */
export function readTestFileDependsOn(
  workspaceRoot: string,
  file: string
): string[] | undefined {
  const projects = parseNxDependsOnDirective(
    readFileSync(join(workspaceRoot, file), 'utf-8')
  );
  if (projects?.length === 0) {
    throw new Error(
      `${file}: "@nx-depends-on:" must list the projects the test depends on, separated by commas.`
    );
  }
  return projects;
}

/**
 * `target` narrowed to the projects a test file names: its dependency inputs
 * (`^…`, `dependencies: true`) become one input selecting `projects`, by the
 * first named input among them (else `default`) and kept under ultracache
 * (`always: true`). Its `dependsOn` entries naming projects, the servers the
 * test talks to, get `inputs: false`.
 */
export function scopeTestTargetToProjects(
  target: TargetConfiguration,
  projects: string[]
): TargetConfiguration {
  return {
    ...target,
    inputs: scopeDependencyInputs(target.inputs, projects),
    ...(target.dependsOn && {
      dependsOn: target.dependsOn.map(
        (dependency): string | TargetDependencyConfig =>
          typeof dependency !== 'string' && dependency.projects
            ? { ...dependency, inputs: false }
            : dependency
      ),
    }),
  };
}

function scopeDependencyInputs(
  inputs: TargetConfiguration['inputs'],
  projects: string[]
): TargetConfiguration['inputs'] {
  let namedInput: string | undefined;
  let position: number | undefined;
  const own: TargetConfiguration['inputs'] = [];
  for (const input of inputs ?? []) {
    const dependency =
      typeof input === 'string'
        ? input.startsWith('^')
        : 'dependencies' in input && input.dependencies === true;
    if (!dependency) {
      own.push(input);
      continue;
    }
    position ??= own.length;
    if (namedInput === undefined) {
      if (typeof input === 'string' && !input.startsWith('^{')) {
        namedInput = input.slice(1);
      } else if (typeof input !== 'string' && 'input' in input) {
        namedInput = input.input;
      }
    }
  }
  own.splice(position ?? own.length, 0, {
    input: namedInput ?? 'default',
    projects,
    always: true,
  });
  return own;
}
