import {
  formatFiles,
  globAsync,
  logger,
  readJson,
  readNxJson,
  type Tree,
  updateNxJson,
} from '@nx/devkit';
import {
  mergeTargetConfigurations,
  readTargetDefaultsForTarget,
} from '@nx/devkit/internal';
import { posix } from 'node:path';

type JsonObject = Record<string, unknown>;

function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Freeze the 24.1 argument contract instead of importing a moving runtime validator.
const loggingSwitch = String.raw`(?:--nologo|(?:--verbosity(?:=|\s+)|-v(?:[:=]|\s+))(?:quiet|minimal|normal|detailed|diagnostic|q|m|n|d|diag))`;
const loggingArguments = new RegExp(
  String.raw`^\s*(?:${loggingSwitch}(?:\s+${loggingSwitch})*)?\s*$`,
  'i'
);
const executionOptions = new Set([
  'args',
  'parallel',
  'readyWhen',
  'color',
  'tty',
  'verbose',
  'no-color',
  'no-parallel',
  'usePty',
  'streamOutput',
]);

function unsafeOptions(value: unknown): boolean {
  if (!object(value)) return value !== undefined;
  for (const [key, option] of Object.entries(value)) {
    if (executionOptions.has(key)) continue;
    const values = Array.isArray(option) ? option : [option];
    if (
      /^verbosity$/i.test(key) &&
      values.every(
        (entry) =>
          typeof entry === 'string' &&
          loggingArguments.test(`--verbosity=${entry}`)
      )
    )
      continue;
    if (/^nologo$/i.test(key) && values.every((entry) => entry === true))
      continue;
    return true;
  }
  const args = value.args;
  if (args === undefined) return false;
  if (typeof args === 'string') return !loggingArguments.test(args);
  if (Array.isArray(args) && args.every((arg) => typeof arg === 'string')) {
    return !loggingArguments.test(args.join(' '));
  }
  return true;
}

function requiresLegacyBuild(value: unknown, publish = false): boolean {
  if (!object(value)) return false;
  if (
    value.outputs !== undefined ||
    value.parallelism === true ||
    value.cache === true ||
    (typeof value.command === 'string' && value.command.length > 0) ||
    (typeof value.executor === 'string' &&
      value.executor !== 'nx:run-commands') ||
    (value.defaultConfiguration !== undefined &&
      (publish
        ? value.defaultConfiguration !== 'release'
        : value.defaultConfiguration !== 'debug' &&
          value.defaultConfiguration !== 'release')) ||
    unsafeOptions(value.options)
  ) {
    return true;
  }
  if (!object(value.configurations)) return value.configurations !== undefined;
  return Object.entries(value.configurations).some(
    ([name, configuration]) =>
      (name !== 'debug' && name !== 'release') || unsafeOptions(configuration)
  );
}

export default async function update(tree: Tree) {
  const unfinished = new Set<string>();
  const report = (message: string) => {
    unfinished.add(message);
    logger.warn(message);
  };
  const result = () =>
    unfinished.size
      ? { nextSteps: [...unfinished], agentContext: [...unfinished] }
      : { skipAgentic: true };
  let nx: ReturnType<typeof readNxJson>;
  try {
    nx = readNxJson(tree);
  } catch {
    report(
      'Could not parse nx.json. Preserve affected @nx/dotnet custom build registrations with options.tfmVariants:false before upgrading.'
    );
    return result();
  }
  if (!nx?.plugins?.length) return result();

  const files = await globAsync(tree, [
    '**/*.csproj',
    '**/*.fsproj',
    '**/*.vbproj',
  ]);
  if (files.length === 0) return result();
  if (nx.extends) {
    report(
      `nx.json extends ${nx.extends}. Inspect inherited @nx/dotnet registrations and targetDefaults; add tfmVariants:false only where existing customized builds require legacy inference.`
    );
  }

  let changed = false;
  for (let index = 0; index < nx.plugins.length; index++) {
    const registration = nx.plugins[index];
    if (typeof registration !== 'string' && !object(registration)) {
      report(
        `nx.json plugins[${index}] is not a valid plugin registration. Recover its intended configuration before upgrading.`
      );
      continue;
    }
    const plugin =
      typeof registration === 'string' ? registration : registration.plugin;
    if (plugin !== '@nx/dotnet' && plugin !== '@nx/dotnet/plugin') continue;
    const rawOptions =
      typeof registration === 'string' ? undefined : registration.options;
    if (rawOptions !== undefined && !object(rawOptions)) {
      report(
        `nx.json plugins[${index}].options is not an object. Recover the intended @nx/dotnet configuration before upgrading.`
      );
      continue;
    }
    const options: JsonObject = object(rawOptions) ? rawOptions : {};
    if (options.tfmVariants !== undefined || options.build === false) continue;

    const included =
      typeof registration === 'string' || !registration.include
        ? new Set(files)
        : new Set(await globAsync(tree, registration.include));
    const excluded =
      typeof registration === 'string' || !registration.exclude
        ? new Set<string>()
        : new Set(await globAsync(tree, registration.exclude));
    const projects = files.filter(
      (file) => included.has(file) && !excluded.has(file)
    );
    if (projects.length === 0) continue;

    const targets = ['build', 'pack', 'publish']
      .filter((kind) => options[kind] !== false)
      .map((kind) => {
        const configuration = options[kind];
        const name =
          object(configuration) && typeof configuration.targetName === 'string'
            ? configuration.targetName
            : kind;
        return { kind, name, configuration };
      });
    let affected = targets.some(({ kind, configuration }) =>
      requiresLegacyBuild(configuration, kind === 'publish')
    );
    const unresolvedSelectors = new Set<string>();
    for (const file of projects) {
      const root = posix.dirname(file);
      const projectFile = posix.join(root, 'project.json');
      const packageFile = posix.join(root, 'package.json');
      let project: JsonObject = {};
      let packageJson: JsonObject = {};
      for (const path of [packageFile, projectFile]) {
        if (!tree.exists(path)) continue;
        try {
          const config: unknown = readJson(tree, path);
          if (object(config)) {
            if (path === projectFile) project = config;
            else packageJson = config;
          }
        } catch {
          report(
            `Could not parse ${path}. Inspect its build overrides and preserve nx.json plugins[${index}] with tfmVariants:false if affected.`
          );
        }
      }
      const packageNx = object(packageJson.nx) ? packageJson.nx : {};
      const packageTargets = object(packageNx.targets) ? packageNx.targets : {};
      const projectTargets = object(project.targets) ? project.targets : {};
      const name =
        typeof project.name === 'string'
          ? project.name
          : typeof packageJson.name === 'string'
            ? packageJson.name
            : undefined;
      const tags = Array.isArray(project.tags)
        ? project.tags
        : Array.isArray(packageNx.tags)
          ? packageNx.tags
          : [];
      const unknownFilteredIdentity =
        !name &&
        Object.values(nx.targetDefaults ?? {}).some(
          (entries) =>
            Array.isArray(entries) &&
            entries.some((entry) => entry.filter?.projects !== undefined)
        );
      if (unknownFilteredIdentity) {
        unresolvedSelectors.add(
          `${file} has no statically declared Nx project name and nx.json contains project-filtered targetDefaults. Resolve its evaluated name before deciding whether plugins[${index}] needs tfmVariants:false.`
        );
      }
      for (const { kind, name: targetName } of targets) {
        for (const target of kind === 'build'
          ? [targetName, `${targetName}:release`]
          : [targetName]) {
          const defaults = unknownFilteredIdentity
            ? null
            : readTargetDefaultsForTarget(
                target,
                nx.targetDefaults,
                'nx:run-commands',
                {
                  sourcePlugin: plugin,
                  command: `dotnet ${kind}`,
                  ...(name && {
                    projectName: name,
                    projectNode: {
                      name,
                      type: 'lib',
                      data: {
                        root,
                        name,
                        tags: tags.filter(
                          (tag): tag is string => typeof tag === 'string'
                        ),
                      },
                    },
                  }),
                }
              );
          const fromPackage = packageTargets[target];
          const fromProject = projectTargets[target];
          affected ||=
            requiresLegacyBuild(defaults, kind === 'publish') ||
            requiresLegacyBuild(fromPackage, kind === 'publish') ||
            requiresLegacyBuild(fromProject, kind === 'publish');
          if (object(fromPackage) && object(fromProject)) {
            affected ||= requiresLegacyBuild(
              mergeTargetConfigurations(fromProject, fromPackage),
              kind === 'publish'
            );
          }
        }
      }
    }
    if (!affected) {
      for (const message of unresolvedSelectors) report(message);
      continue;
    }
    nx.plugins[index] =
      typeof registration === 'string'
        ? { plugin, options: { tfmVariants: false } }
        : { ...registration, options: { ...options, tfmVariants: false } };
    changed = true;
  }
  if (changed) {
    updateNxJson(tree, nx);
    await formatFiles(tree);
  }
  return result();
}
