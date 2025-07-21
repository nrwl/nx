import {
  Tree,
  detectPackageManager,
  formatFiles,
  getPackageManagerCommand,
  getProjects,
  logger,
} from '@nx/devkit';
import { execSync } from 'child_process';
import { getAllReactNativeProjects } from '../../utils/react-native-project-detection';

export default async function update(tree: Tree) {
  const projects = getProjects(tree);
  const reactNativeProjects = await getAllReactNativeProjects(tree, projects);

  if (reactNativeProjects.length === 0) {
    return;
  }

  const pm = detectPackageManager(tree.root);
  const { exec } = getPackageManagerCommand(pm);

  // Run nx upgrade for each React Native project
  for (const projectName of reactNativeProjects) {
    const command = `${exec} nx upgrade ${projectName}`;
    try {
      execSync(command, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
    } catch (error) {
      logger.warn(
        `Failed to upgrade ${projectName}: ${error.message}. Please run '${command}'.`
      );
      // Continue with other projects even if one fails
    }
  }

  await formatFiles(tree);
}
