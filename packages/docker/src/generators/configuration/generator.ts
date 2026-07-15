import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  logger,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { DEFAULT_ENGINE, DEFAULT_TEMPLATE } from './constants';
import { ConfigurationGeneratorSchema } from './schema';

export async function configurationGenerator(
  tree: Tree,
  options: ConfigurationGeneratorSchema
) {
  const project = readProjectConfiguration(tree, options.project);
  const targetName = options.targetName ?? 'container';

  if (project.targets?.[targetName]) {
    throw new Error(
      `Target "${targetName}" already exists on project "${options.project}". Use --targetName to choose a different name.`
    );
  }

  updateProjectConfiguration(tree, options.project, {
    ...project,
    targets: {
      ...project.targets,
      [targetName]: {
        executor: '@nx/docker:build',
        dependsOn: ['build'],
        options: {
          engine: options.engine ?? DEFAULT_ENGINE,
          load: true,
          metadata: {
            images: [project.name],
            tags: [
              'type=schedule',
              'type=ref,event=branch',
              'type=ref,event=tag',
              'type=ref,event=pr',
              'type=sha,prefix=sha-',
            ],
          },
        },
      },
    },
  });

  const dockerfilePath = joinPathFragments(project.root, 'Dockerfile');
  if (tree.exists(dockerfilePath)) {
    logger.info(
      `Skipping Dockerfile generation — "${dockerfilePath}" already exists.`
    );
  } else {
    generateFiles(
      tree,
      joinPathFragments(
        __dirname,
        'files',
        options.template ?? DEFAULT_TEMPLATE
      ),
      project.root,
      { projectName: project.name, template: '' }
    );
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default configurationGenerator;
