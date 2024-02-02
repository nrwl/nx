import {
  CreateDependencies,
  CreateNodes,
  CreateNodesContext,
  TargetConfiguration,
  detectPackageManager,
  joinPathFragments,
  parseJson,
  readJsonFile,
  writeJsonFile,
} from '@nx/devkit';
import { dirname, join } from 'path';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { projectGraphCacheDirectory } from 'nx/src/utils/cache-directory';
import { getLockFileName } from '@nx/js';
import { tsquery } from '@phenomnomnominal/tsquery';

export interface StorybookPluginOptions {
  buildStorybookTargetName?: string;
  serveStorybookTargetName?: string;
  staticStorybookTargetName?: string;
  testStorybookTargetName?: string;
}

const cachePath = join(projectGraphCacheDirectory, 'storybook.hash');
const targetsCache = existsSync(cachePath) ? readTargetsCache() : {};

const calculatedTargets: Record<
  string,
  Record<string, TargetConfiguration>
> = {};

function readTargetsCache(): Record<
  string,
  Record<string, TargetConfiguration>
> {
  return readJsonFile(cachePath);
}

function writeTargetsToCache(
  targets: Record<string, Record<string, TargetConfiguration>>
) {
  writeJsonFile(cachePath, targets);
}

export const createDependencies: CreateDependencies = () => {
  writeTargetsToCache(calculatedTargets);
  return [];
};

export const createNodes: CreateNodes<StorybookPluginOptions> = [
  '**/.storybook/main.{js,ts,mjs,mts,cjs,cts}',
  (configFilePath, options, context) => {
    let projectRoot = '';
    if (configFilePath.includes('/.storybook')) {
      projectRoot = dirname(configFilePath).replace('/.storybook', '');
    } else {
      projectRoot = dirname(configFilePath).replace('.storybook', '');
    }

    if (projectRoot === '') {
      projectRoot = '.';
    }

    // Do not create a project if package.json and project.json isn't there.
    const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
    if (
      !siblingFiles.includes('package.json') &&
      !siblingFiles.includes('project.json')
    ) {
      return {};
    }

    options = normalizeOptions(options);
    const hash = calculateHashForCreateNodes(projectRoot, options, context, [
      getLockFileName(detectPackageManager(context.workspaceRoot)),
    ]);

    const projectName = buildProjectName(projectRoot, context.workspaceRoot);

    const targets = targetsCache[hash]
      ? targetsCache[hash]
      : buildStorybookTargets(
          configFilePath,
          projectRoot,
          options,
          context,
          projectName
        );

    calculatedTargets[hash] = targets;

    const result = {
      projects: {
        [projectRoot]: {
          root: projectRoot,
          targets,
        },
      },
    };

    return result;
  },
];

function buildStorybookTargets(
  configFilePath: string,
  projectRoot: string,
  options: StorybookPluginOptions,
  context: CreateNodesContext,
  projectName: string
) {
  const buildOutputs = getOutputs(projectRoot);

  const namedInputs = getNamedInputs(projectRoot, context);

  const storybookFramework = getStorybookConfig(configFilePath, context);

  const frameworkIsAngular = storybookFramework === "'@storybook/angular'";

  if (frameworkIsAngular && !projectName) {
    throw new Error(
      `Could not find a name for the project at '${projectRoot}'. Please make sure that the project has a package.json or project.json file with name specified.`
    );
  }

  const targets: Record<string, TargetConfiguration> = {};

  targets[options.buildStorybookTargetName] = buildTarget(
    namedInputs,
    buildOutputs,
    projectRoot,
    frameworkIsAngular,
    projectName,
    configFilePath
  );

  targets[options.serveStorybookTargetName] = serveTarget(
    projectRoot,
    frameworkIsAngular,
    projectName,
    configFilePath
  );

  targets[options.testStorybookTargetName] = testTarget(projectRoot);

  targets[options.staticStorybookTargetName] = serveStaticTarget(
    options,
    projectRoot
  );

  return targets;
}

function buildTarget(
  namedInputs: {
    [inputName: string]: any[];
  },
  outputs: string[],
  projectRoot: string,
  frameworkIsAngular: boolean,
  projectName: string,
  configFilePath: string
) {
  let targetConfig: TargetConfiguration;

  if (frameworkIsAngular) {
    targetConfig = {
      executor: '@storybook/angular:build-storybook',
      options: {
        configDir: `${dirname(configFilePath)}`,
        browserTarget: `${projectName}:build-storybook`,
        compodoc: false,
        outputDir: joinPathFragments(projectRoot, 'storybook-static'),
      },
      cache: true,
      outputs,
      inputs: [
        ...('production' in namedInputs
          ? ['production', '^production']
          : ['default', '^default']),
        {
          externalDependencies: [
            'storybook',
            '@storybook/angular',
            '@storybook/test-runner',
          ],
        },
      ],
    };
  } else {
    targetConfig = {
      command: `storybook build`,
      options: { cwd: projectRoot },
      cache: true,
      outputs,
      inputs: [
        ...('production' in namedInputs
          ? ['production', '^production']
          : ['default', '^default']),
        {
          externalDependencies: ['storybook', '@storybook/test-runner'],
        },
      ],
    };
  }

  return targetConfig;
}

function serveTarget(
  projectRoot: string,
  frameworkIsAngular: boolean,
  projectName: string,
  configFilePath: string
) {
  if (frameworkIsAngular) {
    return {
      executor: '@storybook/angular:start-storybook',
      options: {
        configDir: `${dirname(configFilePath)}`,
        browserTarget: `${projectName}:build-storybook`,
        compodoc: false,
      },
    };
  } else {
    return {
      command: `storybook dev`,
      options: { cwd: projectRoot },
    };
  }
}

function testTarget(projectRoot: string) {
  const targetConfig: TargetConfiguration = {
    command: `test-storybook`,
    options: { cwd: projectRoot },
    inputs: [
      {
        externalDependencies: ['storybook', '@storybook/test-runner'],
      },
    ],
  };

  return targetConfig;
}

function serveStaticTarget(
  options: StorybookPluginOptions,
  projectRoot: string
) {
  const targetConfig: TargetConfiguration = {
    executor: '@nx/web:file-server',
    options: {
      buildTarget: `${options.buildStorybookTargetName}`,
      staticFilePath: joinPathFragments(projectRoot, 'storybook-static'),
    },
  };

  return targetConfig;
}

function getStorybookConfig(
  configFilePath: string,
  context: CreateNodesContext
): string {
  const resolvedPath = join(context.workspaceRoot, configFilePath);
  const mainTsJs = readFileSync(resolvedPath, 'utf-8');
  const importDeclarations = tsquery.query(
    mainTsJs,
    'ImportDeclaration:has(ImportSpecifier:has([text="StorybookConfig"]))'
  )?.[0];

  const storybookConfigImportPackage = tsquery.query(
    importDeclarations,
    'StringLiteral'
  )?.[0];

  let frameworkName: string | undefined;

  if (storybookConfigImportPackage?.getText() === `'@storybook/core-common'`) {
    const frameworkPropertyAssignment = tsquery.query(
      mainTsJs,
      `PropertyAssignment:has(Identifier:has([text="framework"]))`
    )?.[0];

    if (!frameworkPropertyAssignment) {
      return;
    }

    const propertyAssignments = tsquery.query(
      frameworkPropertyAssignment,
      `PropertyAssignment:has(Identifier:has([text="name"]))`
    );

    const namePropertyAssignment = propertyAssignments?.find((expression) => {
      return expression.getText().startsWith('name');
    });

    if (!namePropertyAssignment) {
      const storybookConfigImportPackage = tsquery.query(
        frameworkPropertyAssignment,
        'StringLiteral'
      )?.[0];
      frameworkName = storybookConfigImportPackage?.getText();
    } else {
      frameworkName = tsquery
        .query(namePropertyAssignment, `StringLiteral`)?.[0]
        ?.getText();
    }
  } else {
    frameworkName = storybookConfigImportPackage?.getText();
  }
  return frameworkName;
}

function getOutputs(projectRoot: string): string[] {
  const normalizedOutputPath = normalizeOutputPath(projectRoot);

  const outputs = [
    normalizedOutputPath,
    `{options.output-dir}`,
    `{options.outputDir}`,
    `{options.o}`,
  ];

  return outputs;
}

function normalizeOutputPath(projectRoot: string): string | undefined {
  if (projectRoot === '.') {
    return `{projectRoot}/storybook-static`;
  } else {
    return `{workspaceRoot}/{projectRoot}/storybook-static`;
  }
}

function normalizeOptions(
  options: StorybookPluginOptions
): StorybookPluginOptions {
  options ??= {};
  options.buildStorybookTargetName = 'build-storybook';
  options.serveStorybookTargetName = 'storybook';
  options.testStorybookTargetName = 'test-storybook';
  options.staticStorybookTargetName = 'static-storybook';
  return options;
}

function buildProjectName(
  projectRoot: string,
  workspaceRoot: string
): string | undefined {
  const packageJsonPath = join(workspaceRoot, projectRoot, 'package.json');
  const projectJsonPath = join(workspaceRoot, projectRoot, 'project.json');
  let name: string;
  if (existsSync(projectJsonPath)) {
    const projectJson = parseJson(readFileSync(projectJsonPath, 'utf-8'));
    name = projectJson.name;
  } else if (existsSync(packageJsonPath)) {
    const packageJson = parseJson(readFileSync(packageJsonPath, 'utf-8'));
    name = packageJson.name;
  }
  return name;
}
