import componentStoryGenerator from '../component-story/component-story';
import componentCypressSpecGenerator from '../component-cypress-spec/component-cypress-spec';
import {
  findExportDeclarationsForJsx,
  getComponentNode,
} from '../../utils/ast-utils';
import {
  addDependenciesToPackageJson,
  ensurePackage,
  formatFiles,
  GeneratorCallback,
  getProjects,
  joinPathFragments,
  logger,
  ProjectConfiguration,
  runTasksInSerial,
  Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { basename, join } from 'path';
import { minimatch } from 'minimatch';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { nxVersion } from '../../utils/versions';

let tsModule: typeof import('typescript');

export interface StorybookStoriesSchema {
  project: string;
  interactionTests?: boolean;
  js?: boolean;
  ignorePaths?: string[];
  skipFormat?: boolean;
  cypressProject?: string;
  generateCypressSpecs?: boolean;
}

export async function projectRootPath(
  tree: Tree,
  config: ProjectConfiguration
): Promise<string> {
  let projectDir: string;
  if (config.projectType === 'application') {
    const isNextJs = await isNextJsProject(tree, config);
    if (isNextJs) {
      // Next.js apps
      projectDir = 'components';
    } else {
      // apps/test-app/src/app
      projectDir = 'app';
    }
  } else if (config.projectType == 'library') {
    // libs/test-lib/src/lib
    projectDir = 'lib';
  }
  return joinPathFragments(config.sourceRoot, projectDir);
}

export function containsComponentDeclaration(
  tree: Tree,
  componentPath: string
): boolean {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const contents = tree.read(componentPath, 'utf-8');
  if (contents === null) {
    throw new Error(`Failed to read ${componentPath}`);
  }

  const sourceFile = tsModule.createSourceFile(
    componentPath,
    contents,
    tsModule.ScriptTarget.Latest,
    true
  );

  return !!(
    getComponentNode(sourceFile) ||
    findExportDeclarationsForJsx(sourceFile)?.length
  );
}

export async function createAllStories(
  tree: Tree,
  projectName: string,
  interactionTests: boolean,
  js: boolean,
  projects: Map<string, ProjectConfiguration>,
  projectConfiguration: ProjectConfiguration,
  generateCypressSpecs?: boolean,
  cypressProject?: string,
  ignorePaths?: string[]
) {
  const { isTheFileAStory } = await import('@nx/storybook/src/utils/utilities');

  const { sourceRoot, root } = projectConfiguration;
  let componentPaths: string[] = [];

  const projectPath = await projectRootPath(tree, projectConfiguration);
  visitNotIgnoredFiles(tree, projectPath, (path) => {
    // Ignore private files starting with "_".
    if (basename(path).startsWith('_')) return;

    if (ignorePaths?.some((pattern) => minimatch(path, pattern))) return;

    if (
      (path.endsWith('.tsx') && !path.endsWith('.spec.tsx')) ||
      (path.endsWith('.js') && !path.endsWith('.spec.js')) ||
      (path.endsWith('.jsx') && !path.endsWith('.spec.jsx'))
    ) {
      // Check if file is NOT a story (either ts/tsx or js/jsx)
      if (!isTheFileAStory(tree, path)) {
        // Since the file is not a story
        // Let's see if the .stories.* file exists
        const ext = path.slice(path.lastIndexOf('.'));
        const storyPath = `${path.split(ext)[0]}.stories${ext}`;

        if (!tree.exists(storyPath)) {
          componentPaths.push(path);
        }
      }
    }
  });

  const e2eProjectName = cypressProject || `${projectName}-e2e`;
  const e2eProject = projects.get(e2eProjectName);

  if (generateCypressSpecs && !e2eProject) {
    logger.info(
      `There was no e2e project "${e2eProjectName}" found, so cypress specs will not be generated. Pass "--cypressProject" to specify a different e2e project name`
    );
  }

  await Promise.all(
    componentPaths.map(async (componentPath) => {
      const relativeCmpDir = componentPath.replace(join(sourceRoot, '/'), '');

      if (!containsComponentDeclaration(tree, componentPath)) {
        return;
      }

      await componentStoryGenerator(tree, {
        componentPath: relativeCmpDir,
        project: projectName,
        skipFormat: true,
        interactionTests,
      });

      if (generateCypressSpecs && e2eProject) {
        await componentCypressSpecGenerator(tree, {
          project: projectName,
          componentPath: relativeCmpDir,
          js,
          cypressProject,
          skipFormat: true,
        });
      }
    })
  );
}

export async function storiesGenerator(
  host: Tree,
  schema: StorybookStoriesSchema
) {
  const projects = getProjects(host);
  const projectConfiguration = projects.get(schema.project);
  schema.interactionTests = schema.interactionTests ?? true;
  await createAllStories(
    host,
    schema.project,
    schema.interactionTests,
    schema.js,
    projects,
    projectConfiguration,
    schema.generateCypressSpecs,
    schema.cypressProject,
    schema.ignorePaths
  );

  const tasks: GeneratorCallback[] = [];

  if (schema.interactionTests) {
    const { interactionTestsDependencies, addInteractionsInAddons } =
      ensurePackage<typeof import('@nx/storybook')>('@nx/storybook', nxVersion);
    tasks.push(
      addDependenciesToPackageJson(host, {}, interactionTestsDependencies())
    );
    addInteractionsInAddons(host, projectConfiguration);
  }

  if (!schema.skipFormat) {
    await formatFiles(host);
  }
  return runTasksInSerial(...tasks);
}

async function isNextJsProject(tree: Tree, config: ProjectConfiguration) {
  const { findStorybookAndBuildTargetsAndCompiler } = await import(
    '@nx/storybook/src/utils/utilities'
  );

  const { nextBuildTarget } = findStorybookAndBuildTargetsAndCompiler(
    config.targets
  );
  if (nextBuildTarget) {
    return true;
  }

  for (const configFile of ['next.config.js', 'next.config.ts']) {
    if (tree.exists(join(config.root, configFile))) {
      return true;
    }
  }

  return false;
}

export default storiesGenerator;
