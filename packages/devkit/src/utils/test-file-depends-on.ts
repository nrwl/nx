import type { TargetConfiguration } from 'nx/src/devkit-exports';
import { withoutServerInputs } from './without-server-inputs';

/** The distinct projects the `@nx-depends-on` values name. */
export function dependsOnProjects(values: string[]): string[] {
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
 * `target` narrowed to the projects a test file names: its dependency inputs
 * (`^…`, `dependencies: true`) become two inputs selecting `projects` and their
 * dependencies, by the first named input among them (else `default`) and kept
 * under ultracache (`always: true`). Its `dependsOn` entries naming projects,
 * the servers the test talks to, get `inputs: false`.
 */
export function scopeTestTargetToProjects(
  target: TargetConfiguration,
  projects: string[]
): TargetConfiguration {
  return {
    ...target,
    inputs: scopeDependencyInputs(target.inputs, projects),
    ...(target.dependsOn && {
      dependsOn: withoutServerInputs(target.dependsOn),
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
  const input = namedInput ?? 'default';
  own.splice(
    position ?? own.length,
    0,
    { input, projects, always: true },
    { input, projects, dependencies: true, always: true }
  );
  return own;
}
