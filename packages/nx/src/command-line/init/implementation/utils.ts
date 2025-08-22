import { execSync } from 'child_process';
import { join } from 'path';

import { NxJsonConfiguration } from '../../../config/nx-json';
import {
  directoryExists,
  fileExists,
  readJsonFile,
  writeJsonFile,
} from '../../../utils/fileutils';
import { output } from '../../../utils/output';
import { PackageJson } from '../../../utils/package-json';
import {
  getPackageManagerCommand,
  PackageManagerCommands,
} from '../../../utils/package-manager';
import { joinPathFragments } from '../../../utils/path';
import { nxVersion } from '../../../utils/versions';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { printSuccessMessage } from '../../../nx-cloud/generators/connect-to-nx-cloud/connect-to-nx-cloud';
import { connectWorkspaceToCloud } from '../../nx-cloud/connect/connect-to-nx-cloud';
import { deduceDefaultBase } from './deduce-default-base';
import { getRunNxBaseCommand } from '../../../utils/child-process';

export function createNxJsonFile(
  repoRoot: string,
  topologicalTargets: string[],
  cacheableOperations: string[],
  scriptOutputs: { [name: string]: string }
) {
  const nxJsonPath = joinPathFragments(repoRoot, 'nx.json');
  let nxJson = {} as Partial<NxJsonConfiguration> & { $schema: string };
  try {
    nxJson = readJsonFile(nxJsonPath);
    // eslint-disable-next-line no-empty
  } catch {}

  nxJson.$schema = './node_modules/nx/schemas/nx-schema.json';
  nxJson.targetDefaults ??= {};

  if (topologicalTargets.length > 0) {
    for (const scriptName of topologicalTargets) {
      nxJson.targetDefaults[scriptName] ??= {};
      nxJson.targetDefaults[scriptName] = { dependsOn: [`^${scriptName}`] };
    }
  }
  for (const [scriptName, output] of Object.entries(scriptOutputs)) {
    if (!output) {
      // eslint-disable-next-line no-continue
      continue;
    }
    nxJson.targetDefaults[scriptName] ??= {};
    nxJson.targetDefaults[scriptName].outputs = [`{projectRoot}/${output}`];
  }

  for (const target of cacheableOperations) {
    nxJson.targetDefaults[target] ??= {};
    nxJson.targetDefaults[target].cache ??= true;
  }

  if (Object.keys(nxJson.targetDefaults).length === 0) {
    delete nxJson.targetDefaults;
  }

  const defaultBase = deduceDefaultBase();
  // Do not add defaultBase if it is inferred to be the Nx default value of main
  if (defaultBase !== 'main') {
    nxJson.defaultBase ??= defaultBase;
  }
  writeJsonFile(nxJsonPath, nxJson);
}

export function createNxJsonFromTurboJson(
  turboJson: Record<string, any>
): NxJsonConfiguration {
  const nxJson: NxJsonConfiguration = {
    $schema: './node_modules/nx/schemas/nx-schema.json',
  };

  // Handle global dependencies
  if (turboJson.globalDependencies?.length > 0) {
    nxJson.namedInputs = {
      sharedGlobals: turboJson.globalDependencies.map(
        (dep) => `{workspaceRoot}/${dep}`
      ),
      default: ['{projectRoot}/**/*', 'sharedGlobals'],
    };
  }

  // Handle global env vars
  if (turboJson.globalEnv?.length > 0) {
    nxJson.namedInputs = nxJson.namedInputs || {};
    nxJson.namedInputs.sharedGlobals = nxJson.namedInputs.sharedGlobals || [];
    nxJson.namedInputs.sharedGlobals.push(
      ...turboJson.globalEnv.map((env) => ({ env }))
    );
    nxJson.namedInputs.default = nxJson.namedInputs.default || [];
    if (!nxJson.namedInputs.default.includes('{projectRoot}/**/*')) {
      nxJson.namedInputs.default.push('{projectRoot}/**/*');
    }
    if (!nxJson.namedInputs.default.includes('sharedGlobals')) {
      nxJson.namedInputs.default.push('sharedGlobals');
    }
  }

  // Handle task configurations
  if (turboJson.tasks) {
    nxJson.targetDefaults = {};

    for (const [taskName, taskConfig] of Object.entries(turboJson.tasks)) {
      // Skip project-specific tasks (containing #)
      if (taskName.includes('#')) continue;

      const config = taskConfig as any;
      nxJson.targetDefaults[taskName] = {};

      // Handle dependsOn
      if (config.dependsOn?.length > 0) {
        nxJson.targetDefaults[taskName].dependsOn = config.dependsOn;
      }

      // Handle inputs
      if (config.inputs?.length > 0) {
        nxJson.targetDefaults[taskName].inputs = config.inputs
          .map((input) => {
            if (input === '$TURBO_DEFAULT$') {
              return '{projectRoot}/**/*';
            }
            // Don't add projectRoot if it's already there or if it's an env var
            if (
              input.startsWith('{projectRoot}/') ||
              input.startsWith('{env.') ||
              input.startsWith('$')
            )
              return input;
            return `{projectRoot}/${input}`;
          })
          .map((input) => {
            // Don't add projectRoot if it's already there or if it's an env var
            if (
              input.startsWith('{projectRoot}/') ||
              input.startsWith('{env.') ||
              input.startsWith('$')
            )
              return input;
            return `{projectRoot}/${input}`;
          });
      }

      // Handle outputs
      if (config.outputs?.length > 0) {
        nxJson.targetDefaults[taskName].outputs = config.outputs.map(
          (output) => {
            // Don't add projectRoot if it's already there
            if (output.startsWith('{projectRoot}/')) return output;
            // Handle negated patterns by adding projectRoot after the !
            if (output.startsWith('!')) {
              return `!{projectRoot}/${output.slice(1)}`;
            }
            return `{projectRoot}/${output}`;
          }
        );
      }

      // Handle cache setting - true by default in Turbo
      nxJson.targetDefaults[taskName].cache = config.cache !== false;
    }
  }

  /**
   * The fact that cacheDir was in use suggests the user had a reason for deviating from the default.
   * We can't know what that reason was, nor if it would still be applicable in Nx, but we can at least
   * improve discoverability of the relevant Nx option by explicitly including it with its default value.
   */
  if (turboJson.cacheDir) {
    nxJson.cacheDirectory = '.nx/cache';
  }

  const defaultBase = deduceDefaultBase();
  // Do not add defaultBase if it is inferred to be the Nx default value of main
  if (defaultBase !== 'main') {
    nxJson.defaultBase ??= defaultBase;
  }

  return nxJson;
}

export function addDepsToPackageJson(
  repoRoot: string,
  additionalPackages?: string[]
) {
  const path = joinPathFragments(repoRoot, `package.json`);
  const json = readJsonFile(path);
  if (!json.devDependencies) json.devDependencies = {};
  json.devDependencies['nx'] = nxVersion;
  if (additionalPackages) {
    for (const p of additionalPackages) {
      json.devDependencies[p] = nxVersion;
    }
  }
  writeJsonFile(path, json);
}

export function updateGitIgnore(root: string) {
  const ignorePath = join(root, '.gitignore');
  try {
    let contents = readFileSync(ignorePath, 'utf-8');
    const lines = contents.split('\n');
    let sepIncluded = false;
    if (!contents.includes('.nx/cache')) {
      if (!sepIncluded) {
        lines.push('\n');
        sepIncluded = true;
      }
      lines.push('.nx/cache');
    }
    if (!contents.includes('.nx/workspace-data')) {
      if (!sepIncluded) {
        lines.push('\n');
        sepIncluded = true;
      }
      lines.push('.nx/workspace-data');
    }
    if (!contents.includes('.cursor/rules/nx-rules.mdc')) {
      if (!sepIncluded) {
        lines.push('\n');
        sepIncluded = true;
      }
      lines.push('.cursor/rules/nx-rules.mdc');
    }
    if (!contents.includes('.github/instructions/nx.instructions.md')) {
      if (!sepIncluded) {
        lines.push('\n');
        sepIncluded = true;
      }
      lines.push('.github/instructions/nx.instructions.md');
    }

    writeFileSync(ignorePath, lines.join('\n'), 'utf-8');
  } catch {}
}

export function runInstall(
  repoRoot: string,
  pmc: PackageManagerCommands = getPackageManagerCommand()
) {
  execSync(pmc.install, {
    stdio: [0, 1, 2],
    cwd: repoRoot,
    windowsHide: false,
  });
}

export async function initCloud(
  installationSource:
    | 'nx-init'
    | 'nx-init-angular'
    | 'nx-init-cra'
    | 'nx-init-monorepo'
    | 'nx-init-nest'
    | 'nx-init-npm-repo'
    | 'nx-init-turborepo'
) {
  const token = await connectWorkspaceToCloud({
    installationSource,
  });
  await printSuccessMessage(token, installationSource);
}

export function addVsCodeRecommendedExtensions(
  repoRoot: string,
  extensions: string[]
): void {
  const vsCodeExtensionsPath = join(repoRoot, '.vscode/extensions.json');

  if (fileExists(vsCodeExtensionsPath)) {
    const vsCodeExtensionsJson = readJsonFile(vsCodeExtensionsPath);

    vsCodeExtensionsJson.recommendations ??= [];
    extensions.forEach((extension) => {
      if (!vsCodeExtensionsJson.recommendations.includes(extension)) {
        vsCodeExtensionsJson.recommendations.push(extension);
      }
    });

    writeJsonFile(vsCodeExtensionsPath, vsCodeExtensionsJson);
  } else {
    writeJsonFile(vsCodeExtensionsPath, { recommendations: extensions });
  }
}

export function markRootPackageJsonAsNxProjectLegacy(
  repoRoot: string,
  cacheableScripts: string[],
  pmc: PackageManagerCommands
) {
  const json = readJsonFile<PackageJson>(
    joinPathFragments(repoRoot, `package.json`)
  );
  json.nx = {};
  for (let script of cacheableScripts) {
    const scriptDefinition = json.scripts[script];
    if (!scriptDefinition) {
      continue;
    }

    if (scriptDefinition.includes('&&') || scriptDefinition.includes('||')) {
      let backingScriptName = `_${script}`;
      json.scripts[backingScriptName] = scriptDefinition;
      json.scripts[script] = `nx exec -- ${pmc.run(backingScriptName, '')}`;
    } else {
      json.scripts[script] = `nx exec -- ${json.scripts[script]}`;
    }
  }
  writeJsonFile(`package.json`, json);
}

export function markPackageJsonAsNxProject(packageJsonPath: string) {
  const json = readJsonFile<PackageJson>(packageJsonPath);
  if (!json.scripts) {
    return;
  }

  json.nx = {};
  writeJsonFile(packageJsonPath, json);
}

export function printFinalMessage({
  learnMoreLink,
  appendLines,
}: {
  learnMoreLink?: string;
  appendLines?: string[];
}): void {
  output.success({
    title: '🎉 Done!',
    bodyLines: [
      `- Learn more about what to do next at ${
        learnMoreLink ?? 'https://nx.dev/getting-started/adding-to-existing'
      }`,
      ...(appendLines ?? []),
    ].filter(Boolean),
  });
}

export function isMonorepo(packageJson: PackageJson) {
  if (!!packageJson.workspaces) return true;

  try {
    const content = readFileSync('pnpm-workspace.yaml', 'utf-8');
    const { load } = require('@zkochan/js-yaml');
    const { packages } = load(content) ?? {};

    if (packages) {
      return true;
    }
  } catch {}

  if (existsSync('lerna.json')) return true;

  return false;
}

export function isCRA(packageJson: PackageJson) {
  const combinedDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  return (
    // Required dependencies for CRA projects
    combinedDependencies['react'] &&
    combinedDependencies['react-dom'] &&
    combinedDependencies['react-scripts'] &&
    directoryExists('src') &&
    directoryExists('public')
  );
}
