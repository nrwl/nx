import { formatFiles, getProjects, Tree } from '@nx/devkit';
import { MigrateDocsGeneratorSchema } from './schema';
import { moveGenerator } from '../move/move';

export default async function (
  tree: Tree,
  options: MigrateDocsGeneratorSchema
) {
  const projects = getProjects(tree);

  for (const [projectName, projectConfiguration] of projects) {
    if (
      projectConfiguration.root.startsWith('nx-dev') ||
      projectConfiguration.root.startsWith('graph') ||
      projectConfiguration.name === 'typedoc-theme'
    ) {
      console.log('MIGRATING', projectName, projectConfiguration.root);
      await moveGenerator(tree, {
        projectName,
        newProjectName: projectName,
        destination: projectConfiguration.root + '-somethingnot',
        destinationRelativeToRoot: true,
        updateImportPath: true,
        importPath: '@nx/' + projectConfiguration.root,
        skipFormat: true,
      });
    }

    // if (projectConfiguration.root.endsWith('-somethingnot')) {
    // console.log('MIGRATING', projectName, projectConfiguration.root);
    //   await moveGenerator(tree, {
    //     projectName,
    //     newProjectName: projectName,
    //     destination: projectConfiguration.root.replace('-somethingnot', ''),
    //     destinationRelativeToRoot: true,
    //     updateImportPath: true,
    //     importPath:
    //       '@nx/' + projectConfiguration.root.replace('-somethingnot', ''),
    //     skipFormat: true,
    //   });
    // }
  }

  await formatFiles(tree);
}
