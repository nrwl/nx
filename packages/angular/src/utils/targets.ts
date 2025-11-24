import type {
  ProjectConfiguration,
  Target,
  TargetConfiguration,
} from '@nx/devkit';

export function* allProjectTargets<T>(
  project: ProjectConfiguration
): Iterable<[name: string, target: TargetConfiguration<T>]> {
  for (const [name, target] of Object.entries(project.targets ?? {})) {
    yield [name, target];
  }
}

export function* allTargetOptions<T>(
  target: TargetConfiguration<T>
): Iterable<[string | undefined, T]> {
  if (target.options) {
    yield [undefined, target.options];
  }

  if (!target.configurations) {
    return;
  }

  for (const [name, options] of Object.entries(target.configurations)) {
    if (options !== undefined) {
      yield [name, options];
    }
  }
}

/**
 * Return a Target tuple from a specifier string.
 * Supports abbreviated target specifiers (examples: `::`, `::development`, or `:build:production`).
 */
export function targetFromTargetString(
  specifier: string,
  abbreviatedProjectName?: string,
  abbreviatedTargetName?: string
): Target {
  const tuple = specifier.split(':', 3);
  if (tuple.length < 2) {
    throw new Error('Invalid target string: ' + JSON.stringify(specifier));
  }

  return {
    project: tuple[0] || abbreviatedProjectName || '',
    target: tuple[1] || abbreviatedTargetName || '',
    ...(tuple[2] !== undefined && { configuration: tuple[2] }),
  };
}
