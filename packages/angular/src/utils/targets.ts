import type { ProjectConfiguration, TargetConfiguration } from '@nx/devkit';

export function* allProjectTargets(
  project: ProjectConfiguration
): Iterable<TargetConfiguration> {
  for (const target of Object.values(project.targets ?? {})) {
    yield target;
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
