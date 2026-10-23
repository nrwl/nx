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

// Frozen from create-nodes.ts at 5254b70529; migration behavior must not float.
const protectedArgs =
  /--(?:nx-*Args|nx-*Outputs|forward-*All-*Args|__unparsed__)(?:["'=.\s:]|$)|(?:^|\s)@|(?:^|\s)(?:--(?:framework|runtime|configuration|output|artifacts-path|no-dependencies|os|arch)|-[frcoa])(?:[=\s:]|$)|(?:^|\s)(?:[-/](?:p|property):|--property[=:\s])[^\s]*(?:TargetFrameworks?|RuntimeIdentifiers?|Configuration|OutputPath|OutDir|PublishDir|IntermediateOutputPath|ArtifactsPath|UseArtifactsOutput|BaseOutputPath|BaseIntermediateOutputPath|AppendTargetFrameworkToOutputPath|AppendRuntimeIdentifierToOutputPath)\s*=/i;
const protectedOptions =
  /^(?:nx-*Args|nx-*Outputs|__unparsed__|framework|runtime|configuration|output|artifacts-path|commands?|cwd|forward-*All-*Args|no-dependencies|os|arch|[frcoa])$/i;

function unsafeOptions(value: unknown): boolean {
  if (!object(value)) return value !== undefined;
  if (Object.keys(value).some((key) => protectedOptions.test(key))) return true;
  const args = value.args;
  if (args === undefined) return false;
  if (typeof args === 'string') return protectedArgs.test(args);
  if (Array.isArray(args) && args.every((arg) => typeof arg === 'string')) {
    return protectedArgs.test(args.join(' '));
  }
  return true;
}

function requiresLegacyBuild(value: unknown): boolean {
  if (!object(value)) return false;
  if (
    value.outputs !== undefined ||
    value.parallelism === true ||
    value.cache === true ||
    (typeof value.command === 'string' && value.command.length > 0) ||
    (typeof value.executor === 'string' &&
      value.executor !== 'nx:run-commands') ||
    (value.defaultConfiguration !== undefined &&
      value.defaultConfiguration !== 'debug' &&
      value.defaultConfiguration !== 'release') ||
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

    const buildName =
      object(options.build) && typeof options.build.targetName === 'string'
        ? options.build.targetName
        : 'build';
    let affected = requiresLegacyBuild(options.build);
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
      for (const target of [buildName, `${buildName}:release`]) {
        const defaults = unknownFilteredIdentity
          ? null
          : readTargetDefaultsForTarget(
              target,
              nx.targetDefaults,
              'nx:run-commands',
              {
                sourcePlugin: plugin,
                command: 'dotnet build',
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
          requiresLegacyBuild(defaults) ||
          requiresLegacyBuild(fromPackage) ||
          requiresLegacyBuild(fromProject);
        if (object(fromPackage) && object(fromProject)) {
          affected ||= requiresLegacyBuild(
            mergeTargetConfigurations(fromProject, fromPackage)
          );
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
