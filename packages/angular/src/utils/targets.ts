import {
  joinPathFragments,
  readJson,
  type ProjectConfiguration,
  type Target,
  type TargetConfiguration,
  type Tree,
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

  for (const name of Object.keys(target.configurations)) {
    const options = target.configurations[name];
    if (options !== undefined) {
      yield [name, options];
    }
  }
}

/**
 * Whether the target sets at least one `serverTarget` and every one of them,
 * across its options and configurations, satisfies `predicate`. A value that is
 * not a target string fails the check.
 */
export function everyServerTarget(
  target: TargetConfiguration<{ serverTarget?: unknown }>,
  predicate: (serverTarget: Target) => boolean
): boolean {
  let found = false;
  for (const [, options] of allTargetOptions(target)) {
    const serverTarget = options?.serverTarget;
    if (serverTarget === undefined) {
      continue;
    }
    if (
      typeof serverTarget !== 'string' ||
      !serverTarget.includes(':') ||
      !predicate(targetFromTargetString(serverTarget))
    ) {
      return false;
    }
    found = true;
  }
  return found;
}

/**
 * Whether the project has a `project.json` and its `package.json` also has an
 * `nx.targets` entry for the target, which the project graph reads too.
 * Without a `project.json`, generators update the `package.json` entry itself.
 */
export function isTargetAlsoInPackageJson(
  tree: Tree,
  projectRoot: string,
  targetName: string
): boolean {
  const packageJsonPath = joinPathFragments(projectRoot, 'package.json');
  return (
    tree.exists(joinPathFragments(projectRoot, 'project.json')) &&
    tree.exists(packageJsonPath) &&
    readJson(tree, packageJsonPath).nx?.targets?.[targetName] !== undefined
  );
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
