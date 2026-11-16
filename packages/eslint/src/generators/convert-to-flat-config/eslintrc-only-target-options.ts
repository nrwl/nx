import {
  getProjects,
  readNxJson,
  type NxJsonConfiguration,
  type TargetConfiguration,
  type TargetDefaultArrayEntry,
  type Tree,
} from '@nx/devkit';

const ESLINT_PLUGIN = '@nx/eslint/plugin';
export const ESLINT_LINT_EXECUTOR = '@nx/eslint:lint';

// ESLint CLI options that only exist for eslintrc. Converting `@nx/eslint:lint`
// targets to inferred ones carries them over, and flat config supports none.
export const ESLINTRC_ONLY_CLI_OPTIONS = [
  'ignore-path',
  'no-eslintrc',
  'resolve-plugins-relative-to',
  'rulesdir',
] as const;

// How to replace each option, for the reports that list the leftover ones.
export const ESLINTRC_ONLY_OPTIONS_FIXES =
  'For an "ignore-path", pass the file\'s patterns as "--ignore-pattern" flags in the "args" of each run that used it. A flat config\'s "ignores" would apply to every run of that config. ' +
  'ESLint resolves both from the directory it runs in, but the file uses gitignore syntax. Write "dist" as "**/dist" and "/dist" as "dist", and quote each pattern, because Nx passes "args" to the shell unquoted. ' +
  'Load the "rulesdir" rules through a local plugin, pass a "resolve-plugins-relative-to" directory to FlatCompat as "resolvePluginsRelativeTo", and delete "no-eslintrc".';

export function isEslintTarget(target: {
  executor?: string;
  command?: string;
}): boolean {
  return (
    target.executor === ESLINT_LINT_EXECUTOR ||
    target.command?.includes('eslint')
  );
}

export function getEslintPluginTargetNames(
  nxJson: NxJsonConfiguration
): Set<string> {
  const names = new Set<string>();
  for (const plugin of nxJson.plugins ?? []) {
    if (typeof plugin === 'string') {
      if (plugin === ESLINT_PLUGIN) {
        names.add('lint');
      }
    } else if (plugin.plugin === ESLINT_PLUGIN) {
      names.add(
        (plugin.options as { targetName?: string } | undefined)?.targetName ??
          'lint'
      );
    }
  }
  return names;
}

/**
 * A project.json entry that only overrides a target `@nx/eslint/plugin`
 * infers. One with its own executor or command is a different target that
 * shares the name, such as a stylelint `lint` target.
 */
export function isInferredEslintTargetOverride(
  targetName: string,
  target: TargetConfiguration,
  pluginTargetNames: Set<string>
): boolean {
  return (
    pluginTargetNames.has(targetName) &&
    !target.executor &&
    !target.command &&
    !target.options?.command &&
    !target.options?.commands
  );
}

export function isPluginScopedTargetDefault(
  entry: TargetDefaultArrayEntry
): boolean {
  return entry.filter?.plugin === ESLINT_PLUGIN;
}

/**
 * Lists the ESLint lint targets and plugin-scoped `targetDefaults` entries that
 * still pass an eslintrc-only option, one `<where>: <options>` line each.
 */
export function findEslintrcOnlyTargetOptions(tree: Tree): string[] {
  const nxJson = readNxJson(tree) ?? {};
  const pluginTargetNames = getEslintPluginTargetNames(nxJson);
  const found: string[] = [];
  const collect = (where: string, target: Partial<TargetConfiguration>) => {
    const scopes: [string, Record<string, unknown> | undefined][] = [
      [where, target.options],
      ...Object.entries(target.configurations ?? {}).map(
        ([name, options]): [string, Record<string, unknown>] => [
          `${where} (configuration "${name}")`,
          options,
        ]
      ),
    ];
    for (const [scope, options] of scopes) {
      const present = [
        ...ESLINTRC_ONLY_CLI_OPTIONS.filter(
          (option) => options?.[option] !== undefined
        ),
        ...findEslintrcOnlyArgs(options?.args).map(
          (option) => `${option} (in "args")`
        ),
      ];
      if (present.length > 0) {
        found.push(`${scope}: ${present.join(', ')}`);
      }
    }
  };

  for (const [project, projectConfig] of getProjects(tree)) {
    for (const [targetName, target] of Object.entries(
      projectConfig.targets ?? {}
    )) {
      if (
        isEslintTarget(target) ||
        isInferredEslintTargetOverride(targetName, target, pluginTargetNames)
      ) {
        collect(`project "${project}" target "${targetName}"`, target);
      }
    }
  }
  for (const [targetName, value] of Object.entries(
    nxJson.targetDefaults ?? {}
  )) {
    if (!Array.isArray(value)) {
      continue;
    }
    for (const entry of value) {
      if (isPluginScopedTargetDefault(entry)) {
        collect(`nx.json targetDefaults "${targetName}"`, entry);
      }
    }
  }
  return found;
}

// The task passes `args` to ESLint as written, so a flag there fails the same way.
function findEslintrcOnlyArgs(args: unknown): string[] {
  const flags = Array.isArray(args)
    ? args.join(' ')
    : typeof args === 'string'
      ? args
      : '';
  return ESLINTRC_ONLY_CLI_OPTIONS.filter((option) =>
    new RegExp(`(^|\\s)--${option}(?=[\\s=]|$)`).test(flags)
  );
}
