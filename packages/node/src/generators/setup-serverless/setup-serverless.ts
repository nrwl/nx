import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  logger,
  names,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import {
  netlifyCliVersion,
  netlifyFunctionVersion,
} from '../../utils/versions';
import { SetupServerlessFunctionOptions } from './schema';

const serverlessPlatformPackage = {
  netlify: {
    '@netlify/functions': netlifyFunctionVersion,
    'netlify-cli': netlifyCliVersion,
  },
};
function normalizeOptions(
  tree: Tree,
  setupOptions: SetupServerlessFunctionOptions
) {
  const project = setupOptions.project ?? readNxJson(tree).defaultProject;
  const siteName = names(project).fileName;
  return {
    ...setupOptions,
    project,
    site: setupOptions.site ?? siteName,
    buildTarget: setupOptions.buildTarget ?? 'build',
    deployTarget: setupOptions.deployTarget ?? 'deploy',
  };
}

function addServerlessFiles(
  tree: Tree,
  options: SetupServerlessFunctionOptions
) {
  const project = readProjectConfiguration(tree, options.project);
  if (!options.project || !options.deployTarget) {
    return;
  }

  switch (options.platform) {
    case 'netlify':
      if (tree.exists(joinPathFragments(project.root, 'netlify.toml'))) {
        logger.info(
          `Skipping setup since a netlify.toml already exists inside ${project.root}`
        );
      }
      break;

    default:
      return;
  }
  const outputPath =
    project.targets[`${options.buildTarget}`]?.options.outputPath;
  generateFiles(
    tree,
    joinPathFragments(__dirname, `./files/${options.platform}`),
    project.root,
    {
      tmpl: '',
      app: project.sourceRoot,
      outputPath,
    }
  );
}

function updateProjectConfig(
  tree: Tree,
  options: SetupServerlessFunctionOptions
) {
  const projectConfig = readProjectConfiguration(tree, options.project);

  if (projectConfig) {
    projectConfig.targets[`${options.buildTarget}`].options.bundle = true;
    projectConfig.targets[`${options.deployTarget}`] = {
      dependsOn: [`${options.buildTarget}`],
      command: `npx netlify deploy --site ${options.site}`,
      configurations: {
        production: {
          command: `npx netlify deploy --site ${options.site} --prod-if-unlocked`,
        },
      },
    };

    updateProjectConfiguration(tree, options.project, projectConfig);
  }
}

export async function setupServerlessGenerator(
  tree: Tree,
  setupOptions: SetupServerlessFunctionOptions
) {
  const tasks: GeneratorCallback[] = [];
  const options = normalizeOptions(tree, setupOptions);

  addServerlessFiles(tree, options);
  updateProjectConfig(tree, options);

  if (!options.skipPackageJson && ['netlify'].includes(options.platform)) {
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          ...serverlessPlatformPackage[options.platform],
        }
      )
    );
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default setupServerlessGenerator;
export const setupServerlessSchematic = convertNxGenerator(
  setupServerlessGenerator
);
