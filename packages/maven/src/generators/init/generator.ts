import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  Tree,
} from '@nx/devkit';

export interface MavenInitGeneratorSchema {
  skipFormat?: boolean;
}

export async function mavenInitGenerator(
  tree: Tree,
  options: MavenInitGeneratorSchema
) {
  const tasks: GeneratorCallback[] = [];

  // Add Maven-related dependencies if needed
  const installTask = addDependenciesToPackageJson(
    tree,
    {},
    {
      '@nx/maven': 'latest',
    }
  );
  tasks.push(installTask);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return async () => {
    for (const task of tasks) {
      await task();
    }
  };
}

export default mavenInitGenerator;