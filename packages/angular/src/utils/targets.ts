import type { ProjectConfiguration, TargetConfiguration } from '@nx/devkit';

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
