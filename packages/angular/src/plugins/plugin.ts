import {
  type CreateNodesContextV2,
  createNodesFromFiles,
  type CreateNodesResult,
  type CreateNodesV2,
  detectPackageManager,
  getPackageManagerCommand,
  type ProjectConfiguration,
  readJsonFile,
  type Target,
  type TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { getLockFileName } from '@nx/js';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import * as posix from 'node:path/posix';
import { hashObject } from 'nx/src/devkit-internals';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';

export interface AngularPluginOptions {
  targetNamePrefix?: string;
}

type AngularProjects = Record<
  string,
  Pick<ProjectConfiguration, 'projectType' | 'sourceRoot' | 'targets'>
>;

type AngularTargetConfiguration = {
  builder: string;
  options?: Record<string, any>;
  configurations?: Record<string, any>;
  defaultConfiguration?: string;
};
export type AngularProjectConfiguration = {
  projectType: 'application' | 'library';
  root: string;
  sourceRoot?: string;
  architect?: Record<string, AngularTargetConfiguration>;
  targets?: Record<string, AngularTargetConfiguration>;
};
type AngularJson = { projects?: Record<string, AngularProjectConfiguration> };

const knownExecutors = {
  appShell: new Set(['@angular-devkit/build-angular:app-shell']),
  build: new Set([
    '@angular-devkit/build-angular:application',
    '@angular/build:application',
    '@angular-devkit/build-angular:browser-esbuild',
    '@angular-devkit/build-angular:browser',
    '@angular-devkit/build-angular:ng-packagr',
  ]),
  devServer: new Set(['@angular-devkit/build-angular:dev-server']),
  extractI18n: new Set(['@angular-devkit/build-angular:extract-i18n']),
  prerender: new Set([
    '@angular-devkit/build-angular:prerender',
    '@nguniversal/builders:prerender',
  ]),
  server: new Set(['@angular-devkit/build-angular:server']),
  serveSsr: new Set([
    '@angular-devkit/build-angular:ssr-dev-server',
    '@nguniversal/builders:ssr-dev-server',
  ]),
  test: new Set(['@angular-devkit/build-angular:karma']),
};

const pmc = getPackageManagerCommand();

function readProjectsCache(cachePath: string): Record<string, AngularProjects> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

function writeProjectsToCache(
  cachePath: string,
  results: Record<string, AngularProjects>
) {
  writeJsonFile(cachePath, results);
}

export const createNodesV2: CreateNodesV2<AngularPluginOptions> = [
  '**/angular.json',
  async (configFiles, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `angular-${optionsHash}.hash`
    );
    const projectsCache = readProjectsCache(cachePath);
    try {
      return await createNodesFromFiles(
        (configFile, options, context) =>
          createNodesInternal(configFile, options, context, projectsCache),
        configFiles,
        options,
        context
      );
    } finally {
      writeProjectsToCache(cachePath, projectsCache);
    }
  },
];

async function createNodesInternal(
  configFilePath: string,
  options: {} | undefined,
  context: CreateNodesContextV2,
  projectsCache: Record<string, AngularProjects>
): Promise<CreateNodesResult> {
  const angularWorkspaceRoot = dirname(configFilePath);

  // Do not create a project if package.json isn't there
  const siblingFiles = readdirSync(
    join(context.workspaceRoot, angularWorkspaceRoot)
  );
  if (!siblingFiles.includes('package.json')) {
    return {};
  }

  const hash = await calculateHashForCreateNodes(
    angularWorkspaceRoot,
    options,
    context,
    [getLockFileName(detectPackageManager(context.workspaceRoot))]
  );

  projectsCache[hash] ??= await buildAngularProjects(
    configFilePath,
    options,
    angularWorkspaceRoot,
    context
  );

  return { projects: projectsCache[hash] };
}

async function buildAngularProjects(
  configFilePath: string,
  options: AngularPluginOptions,
  angularWorkspaceRoot: string,
  context: CreateNodesContextV2
): Promise<AngularProjects> {
  const projects: Record<string, AngularProjects[string] & { root: string }> =
    {};

  const absoluteConfigFilePath = join(context.workspaceRoot, configFilePath);
  const angularJson = readJsonFile<AngularJson>(absoluteConfigFilePath);

  const appShellTargets: Target[] = [];
  const prerenderTargets: Target[] = [];
  for (const [projectName, project] of Object.entries(
    angularJson.projects ?? {}
  )) {
    const targets: Record<string, TargetConfiguration> = {};

    const projectTargets = getAngularJsonProjectTargets(project);
    if (!projectTargets) {
      continue;
    }

    const namedInputs = getNamedInputs(project.root, context);

    for (const [angularTargetName, angularTarget] of Object.entries(
      projectTargets
    )) {
      const nxTargetName = options?.targetNamePrefix
        ? `${options.targetNamePrefix}${angularTargetName}`
        : angularTargetName;
      const externalDependencies = ['@angular/cli'];

      targets[nxTargetName] = {
        command:
          // For targets that are also Angular CLI commands, infer the simplified form.
          // Otherwise, use `ng run` to support non-command targets so that they will run.
          angularTargetName === 'build' ||
          angularTargetName === 'deploy' ||
          angularTargetName === 'extract-i18n' ||
          angularTargetName === 'e2e' ||
          angularTargetName === 'lint' ||
          angularTargetName === 'serve' ||
          angularTargetName === 'test'
            ? `ng ${angularTargetName}`
            : `ng run ${projectName}:${angularTargetName}`,
        options: { cwd: angularWorkspaceRoot },
        metadata: {
          technologies: ['angular'],
          description: `Run the "${angularTargetName}" target for "${projectName}".`,
          help: {
            command: `${pmc.exec} ng run ${projectName}:${angularTargetName} --help`,
            example: {},
          },
        },
      };

      if (knownExecutors.appShell.has(angularTarget.builder)) {
        appShellTargets.push({ target: nxTargetName, project: projectName });
      } else if (knownExecutors.build.has(angularTarget.builder)) {
        await updateBuildTarget(
          nxTargetName,
          targets[nxTargetName],
          angularTarget,
          context,
          angularWorkspaceRoot,
          project.root,
          namedInputs
        );
      } else if (knownExecutors.devServer.has(angularTarget.builder)) {
        targets[nxTargetName].metadata.help.example.options = { port: 4201 };
      } else if (knownExecutors.extractI18n.has(angularTarget.builder)) {
        targets[nxTargetName].metadata.help.example.options = {
          format: 'json',
        };
      } else if (knownExecutors.test.has(angularTarget.builder)) {
        updateTestTarget(
          targets[nxTargetName],
          angularTarget,
          context,
          angularWorkspaceRoot,
          project.root,
          namedInputs,
          externalDependencies
        );
      } else if (knownExecutors.server.has(angularTarget.builder)) {
        updateServerTarget(
          targets[nxTargetName],
          angularTarget,
          context,
          angularWorkspaceRoot,
          project.root,
          namedInputs
        );
      } else if (knownExecutors.serveSsr.has(angularTarget.builder)) {
        targets[nxTargetName].metadata.help.example.options = { port: 4201 };
      } else if (knownExecutors.prerender.has(angularTarget.builder)) {
        prerenderTargets.push({ target: nxTargetName, project: projectName });
      }

      if (targets[nxTargetName].inputs?.length) {
        targets[nxTargetName].inputs.push({ externalDependencies });
      }

      if (angularTarget.configurations) {
        for (const configurationName of Object.keys(
          angularTarget.configurations
        )) {
          targets[nxTargetName].configurations = {
            ...targets[nxTargetName].configurations,
            [configurationName]: {
              command: `ng run ${projectName}:${angularTargetName}:${configurationName}`,
            },
          };
        }
      }

      if (angularTarget.defaultConfiguration) {
        targets[nxTargetName].defaultConfiguration =
          angularTarget.defaultConfiguration;
      }
    }

    projects[projectName] = {
      projectType: project.projectType,
      root: posix.join(angularWorkspaceRoot, project.root),
      sourceRoot: project.sourceRoot
        ? posix.join(angularWorkspaceRoot, project.sourceRoot)
        : undefined,
      targets,
    };
  }

  for (const { project, target } of appShellTargets) {
    updateAppShellTarget(
      project,
      target,
      projects,
      angularJson,
      angularWorkspaceRoot,
      context
    );
  }

  for (const { project, target } of prerenderTargets) {
    updatePrerenderTarget(project, target, projects, angularJson);
  }

  return Object.entries(projects).reduce((acc, [projectName, project]) => {
    acc[project.root] = {
      projectType: project.projectType,
      sourceRoot: project.sourceRoot,
      targets: project.targets,
    };
    return acc;
  }, {} as AngularProjects);
}

function updateAppShellTarget(
  projectName: string,
  targetName: string,
  projects: AngularProjects,
  angularJson: AngularJson,
  angularWorkspaceRoot: string,
  context: CreateNodesContextV2
): void {
  // it must exist since we collected it when processing it
  const target = projects[projectName].targets[targetName];

  target.metadata.help.example.options = { route: '/some/route' };

  const { inputs, outputs } = getBrowserAndServerTargetInputsAndOutputs(
    projectName,
    targetName,
    projects,
    angularJson
  );

  const outputIndexPath = getAngularJsonProjectTargets(
    angularJson.projects[projectName]
  )[targetName].options?.outputIndexPath;
  if (outputIndexPath) {
    const fullOutputIndexPath = join(
      context.workspaceRoot,
      angularWorkspaceRoot,
      outputIndexPath
    );
    outputs.push(
      getOutput(
        fullOutputIndexPath,
        context.workspaceRoot,
        angularWorkspaceRoot,
        angularJson.projects[projectName].root
      )
    );
  }

  if (!outputs.length) {
    // no outputs were identified for the build or server target, so we don't
    // set any Nx cache options
    return;
  }

  target.cache = true;
  target.inputs = inputs;
  target.outputs = outputs;
}

async function updateBuildTarget(
  targetName: string,
  target: TargetConfiguration,
  angularTarget: AngularTargetConfiguration,
  context: CreateNodesContextV2,
  angularWorkspaceRoot: string,
  projectRoot: string,
  namedInputs: ReturnType<typeof getNamedInputs>
): Promise<void> {
  target.dependsOn = [`^${targetName}`];

  if (angularTarget.options?.outputPath) {
    const fullOutputPath = join(
      context.workspaceRoot,
      angularWorkspaceRoot,
      angularTarget.options.outputPath
    );
    target.outputs = [
      getOutput(
        fullOutputPath,
        context.workspaceRoot,
        angularWorkspaceRoot,
        projectRoot
      ),
    ];
  } else if (
    angularTarget.builder === '@angular-devkit/build-angular:ng-packagr'
  ) {
    const outputs = await getNgPackagrOutputs(
      angularTarget,
      angularWorkspaceRoot,
      projectRoot,
      context
    );
    if (outputs.length) {
      target.outputs = outputs;
    }
  }

  if (target.outputs?.length) {
    // make it cacheable if we were able to identify outputs
    target.cache = true;
    target.inputs =
      'production' in namedInputs
        ? ['production', '^production']
        : ['default', '^default'];
  }

  if (angularTarget.builder === '@angular-devkit/build-angular:ng-packagr') {
    target.metadata.help.example.options = { watch: true };
  } else {
    target.metadata.help.example.options = { localize: true };
  }
}

function updateTestTarget(
  target: TargetConfiguration,
  angularTarget: AngularTargetConfiguration,
  context: CreateNodesContextV2,
  angularWorkspaceRoot: string,
  projectRoot: string,
  namedInputs: ReturnType<typeof getNamedInputs>,
  externalDependencies: string[]
): void {
  target.cache = true;
  target.inputs =
    'production' in namedInputs
      ? ['default', '^production']
      : ['default', '^default'];
  target.outputs = getKarmaTargetOutputs(
    angularTarget,
    angularWorkspaceRoot,
    projectRoot,
    context
  );
  externalDependencies.push('karma');

  target.metadata.help.example.options = { codeCoverage: true };
}

function updateServerTarget(
  target: TargetConfiguration,
  angularTarget: AngularTargetConfiguration,
  context: CreateNodesContextV2,
  angularWorkspaceRoot: string,
  projectRoot: string,
  namedInputs: ReturnType<typeof getNamedInputs>
): void {
  target.metadata.help.example.options = { localize: true };

  if (!angularTarget.options?.outputPath) {
    // only make it cacheable if we were able to identify outputs
    return;
  }

  target.cache = true;
  target.inputs =
    'production' in namedInputs
      ? ['production', '^production']
      : ['default', '^default'];

  const fullOutputPath = join(
    context.workspaceRoot,
    angularWorkspaceRoot,
    angularTarget.options.outputPath
  );
  target.outputs = [
    getOutput(
      fullOutputPath,
      context.workspaceRoot,
      angularWorkspaceRoot,
      projectRoot
    ),
  ];
}

function updatePrerenderTarget(
  projectName: string,
  targetName: string,
  projects: AngularProjects,
  angularJson: AngularJson
): void {
  // it must exist since we collected it when processing it
  const target = projects[projectName].targets[targetName];

  target.metadata.help.example.options =
    getAngularJsonProjectTargets(angularJson.projects[projectName])[targetName]
      .builder === '@angular-devkit/build-angular:prerender'
      ? { discoverRoutes: false }
      : { guessRoutes: false };

  const { inputs, outputs } = getBrowserAndServerTargetInputsAndOutputs(
    projectName,
    targetName,
    projects,
    angularJson
  );

  if (!outputs.length) {
    // no outputs were identified for the build or server target, so we don't
    // set any Nx cache options
    return;
  }

  target.cache = true;
  target.inputs = inputs;
  target.outputs = outputs;
}

async function getNgPackagrOutputs(
  target: AngularTargetConfiguration,
  angularWorkspaceRoot: string,
  projectRoot: string,
  context: CreateNodesContextV2
): Promise<string[]> {
  let ngPackageJsonPath = join(
    context.workspaceRoot,
    angularWorkspaceRoot,
    target.options.project
  );

  const readConfig = async (configPath: string) => {
    if (!existsSync(configPath)) {
      return undefined;
    }

    try {
      if (configPath.endsWith('.js')) {
        const result = await import(configPath);

        return result['default'] ?? result;
      }

      return readJsonFile(configPath);
    } catch {}

    return undefined;
  };

  let ngPackageJson: { dest?: string };
  let basePath: string;
  if (statSync(ngPackageJsonPath).isDirectory()) {
    basePath = ngPackageJsonPath;
    ngPackageJson = await readConfig(
      join(ngPackageJsonPath, 'ng-package.json')
    );
    if (!ngPackageJson) {
      ngPackageJson = await readConfig(
        join(ngPackageJsonPath, 'ng-package.js')
      );
    }
  } else {
    basePath = dirname(ngPackageJsonPath);
    ngPackageJson = await readConfig(ngPackageJsonPath);
  }

  if (!ngPackageJson) {
    return [];
  }

  const destination = ngPackageJson.dest
    ? join(basePath, ngPackageJson.dest)
    : join(basePath, 'dist');

  return [
    getOutput(
      destination,
      context.workspaceRoot,
      angularWorkspaceRoot,
      projectRoot
    ),
  ];
}

function getKarmaTargetOutputs(
  target: AngularTargetConfiguration,
  angularWorkspaceRoot: string,
  projectRoot: string,
  context: CreateNodesContextV2
): string[] {
  const defaultOutput = posix.join(
    '{workspaceRoot}',
    angularWorkspaceRoot,
    'coverage/{projectName}'
  );
  if (!target.options?.karmaConfig) {
    return [defaultOutput];
  }

  try {
    const { parseConfig } = require('karma/lib/config');

    const karmaConfigPath = join(
      context.workspaceRoot,
      angularWorkspaceRoot,
      projectRoot,
      target.options.karmaConfig
    );
    const config = parseConfig(karmaConfigPath);

    if (config.coverageReporter.dir) {
      return [
        getOutput(
          config.coverageReporter.dir,
          context.workspaceRoot,
          angularWorkspaceRoot,
          projectRoot
        ),
      ];
    }
  } catch {
    // we silently ignore any error here and fall back to the default output
  }

  return [defaultOutput];
}

function getBrowserAndServerTargetInputsAndOutputs(
  projectName: string,
  targetName: string,
  projects: AngularProjects,
  angularJson: AngularJson
) {
  const { browserTarget, serverTarget } = extractBrowserAndServerTargets(
    angularJson,
    projectName,
    targetName
  );
  if (!browserTarget || !serverTarget) {
    // if any of these are missing, the target is invalid so we return empty values
    return { inputs: [], outputs: [] };
  }

  const browserTargetInputs =
    projects[browserTarget.project]?.targets?.[browserTarget.target]?.inputs ??
    [];
  const serverTargetInputs =
    projects[serverTarget.project]?.targets?.[serverTarget.target]?.inputs ??
    [];
  const browserTargetOutputs =
    projects[browserTarget.project]?.targets?.[browserTarget.target]?.outputs ??
    [];
  const serverTargetOutputs =
    projects[serverTarget.project]?.targets?.[serverTarget.target]?.outputs ??
    [];

  return {
    inputs: mergeInputs(...browserTargetInputs, ...serverTargetInputs),
    outputs: Array.from(
      new Set([...browserTargetOutputs, ...serverTargetOutputs])
    ),
  };
}

function extractBrowserAndServerTargets(
  angularJson: AngularJson,
  projectName: string,
  targetName: string
): {
  browserTarget: Target;
  serverTarget: Target;
} {
  let browserTarget: Target | undefined;
  let serverTarget: Target | undefined;

  try {
    const targets = getAngularJsonProjectTargets(
      angularJson.projects[projectName]
    );
    const target = targets[targetName];

    let browserTargetSpecifier = target.options?.browserTarget;
    if (!browserTargetSpecifier) {
      const configuration = Object.values(target.configurations ?? {}).find(
        (config) => !!config.browserTarget
      );
      browserTargetSpecifier = configuration?.browserTarget;
    }

    if (browserTargetSpecifier) {
      browserTarget = targetFromTargetString(
        browserTargetSpecifier,
        projectName,
        targetName
      );
    }

    let serverTargetSpecifier = target.options?.serverTarget;
    if (!serverTargetSpecifier) {
      serverTargetSpecifier = Object.values(target.configurations ?? {}).find(
        (config) => !!config.serverTarget
      )?.serverTarget;
    }

    if (serverTargetSpecifier) {
      serverTarget = targetFromTargetString(
        serverTargetSpecifier,
        projectName,
        targetName
      );
    }
  } catch {}

  return { browserTarget: browserTarget, serverTarget };
}

function mergeInputs(
  ...inputs: TargetConfiguration['inputs']
): TargetConfiguration['inputs'] {
  const stringInputs = new Set<string>();
  const externalDependencies = new Set<string>();

  for (const input of inputs) {
    if (typeof input === 'string') {
      stringInputs.add(input);
    } else if ('externalDependencies' in input) {
      // we only infer external dependencies, so we don't need to handle the other input definitions
      for (const externalDependency of input.externalDependencies) {
        externalDependencies.add(externalDependency);
      }
    }
  }

  return [
    ...stringInputs,
    ...(externalDependencies.size
      ? [{ externalDependencies: Array.from(externalDependencies) }]
      : []),
  ];
}

// angular support abbreviated target specifiers, this is adapter from:
// https://github.com/angular/angular-cli/blob/7d9ce246a33c60ec96eb4bf99520f5475716a910/packages/angular_devkit/architect/src/api.ts#L336
function targetFromTargetString(
  specifier: string,
  abbreviatedProjectName?: string,
  abbreviatedTargetName?: string
) {
  const tuple = specifier.split(':', 3);
  if (tuple.length < 2) {
    // invalid target, ignore
    return undefined;
  }

  // we only care about project and target
  return {
    project: tuple[0] || abbreviatedProjectName || '',
    target: tuple[1] || abbreviatedTargetName || '',
  };
}

function getOutput(
  path: string,
  workspaceRoot: string,
  angularWorkspaceRoot: string,
  projectRoot: string
): string {
  const relativePath = relative(
    join(workspaceRoot, angularWorkspaceRoot, projectRoot),
    path
  );
  if (relativePath.startsWith('..')) {
    return posix.join(
      '{workspaceRoot}',
      join(angularWorkspaceRoot, projectRoot, relativePath)
    );
  } else {
    return posix.join('{projectRoot}', relativePath);
  }
}

function getAngularJsonProjectTargets(
  project: AngularProjectConfiguration
): Record<string, AngularTargetConfiguration> {
  return project.architect ?? project.targets;
}
