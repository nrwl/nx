import {
  CreateNodesContextV2,
  createNodesFromFiles,
  CreateNodesV2,
  normalizePath,
} from '@nx/devkit';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface NestPluginOptions {}

const nestCliConfigGlob = '**/nest-cli.json';

export const createNodes: CreateNodesV2<NestPluginOptions> = [
  nestCliConfigGlob,
  async (configFilePaths, options, context) => {
    const validConfigFiles = configFilePaths.filter((configFilePath) =>
      checkIfConfigFileShouldBeProject(
        normalizeProjectRoot(dirname(configFilePath)),
        context
      )
    );

    return createNodesFromFiles(
      (configFilePath) => {
        const projectRoot = normalizeProjectRoot(dirname(configFilePath));

        return {
          projects: {
            [projectRoot]: {
              root: projectRoot,
              targets: {},
              metadata: {
                technologies: ['nest'],
              },
            },
          },
        };
      },
      validConfigFiles,
      options,
      context
    );
  },
];

export const createNodesV2 = createNodes;

function normalizeProjectRoot(projectRoot: string): string {
  return normalizePath(projectRoot);
}

function checkIfConfigFileShouldBeProject(
  projectRoot: string,
  context: CreateNodesContextV2
): boolean {
  const absoluteProjectRoot = join(context.workspaceRoot, projectRoot);

  if (!existsSync(absoluteProjectRoot)) {
    return false;
  }

  const siblingFiles = readdirSync(absoluteProjectRoot);

  return (
    siblingFiles.includes('package.json') ||
    siblingFiles.includes('project.json')
  );
}
