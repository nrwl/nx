import { execSync } from 'child_process';
import { join } from 'path';

import { NxJsonConfiguration } from '../../../config/nx-json';
import {
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
import { repoUsesGithub } from '../../../nx-cloud/utilities/url-shorten';
import { connectWorkspaceToCloud } from '../../connect/connect-to-nx-cloud';
import { deduceDefaultBase as gitInitDefaultBase } from '../../../utils/default-base';

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

  nxJson.defaultBase ??= deduceDefaultBase();
  writeJsonFile(nxJsonPath, nxJson);
}

function deduceDefaultBase() {
  try {
    execSync(`git rev-parse --verify main`, {
      stdio: ['ignore', 'ignore', 'ignore'],
      windowsHide: false,
    });
    return 'main';
  } catch {
    try {
      execSync(`git rev-parse --verify dev`, {
        stdio: ['ignore', 'ignore', 'ignore'],
        windowsHide: false,
      });
      return 'dev';
    } catch {
      try {
        execSync(`git rev-parse --verify develop`, {
          stdio: ['ignore', 'ignore', 'ignore'],
          windowsHide: false,
        });
        return 'develop';
      } catch {
        try {
          execSync(`git rev-parse --verify next`, {
            stdio: ['ignore', 'ignore', 'ignore'],
            windowsHide: false,
          });
          return 'next';
        } catch {
          try {
            execSync(`git rev-parse --verify master`, {
              stdio: ['ignore', 'ignore', 'ignore'],
              windowsHide: false,
            });
            return 'master';
          } catch {
            return gitInitDefaultBase();
          }
        }
      }
    }
  }
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
) {
  const token = await connectWorkspaceToCloud({
    installationSource,
  });
  await printSuccessMessage(token, installationSource, await repoUsesGithub());
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
}: {
  learnMoreLink?: string;
}): void {
  const pmc = getPackageManagerCommand();

  output.success({
    title: '🎉 Done!',
    bodyLines: [
      `- Run "${pmc.exec} nx run-many -t build" to run the build target for every project in the workspace. Run it again to replay the cached computation. https://nx.dev/features/cache-task-results`,
      `- Run "${pmc.exec} nx graph" to see the graph of projects and tasks in your workspace. https://nx.dev/core-features/explore-graph`,
      learnMoreLink ? `- Learn more at ${learnMoreLink}.` : undefined,
    ].filter(Boolean),
  });
}

export function isMonorepo(packageJson: PackageJson) {
  if (!!packageJson.workspaces) return true;

  if (existsSync('pnpm-workspace.yaml') || existsSync('pnpm-workspace.yml'))
    return true;

  if (existsSync('lerna.json')) return true;

  return false;
}
