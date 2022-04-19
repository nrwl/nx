import {
  Tree,
  formatFiles,
  getProjects,
  updateJson,
  ProjectConfiguration,
} from '@nrwl/devkit';

/**
 * Update jest.config.json under detox project, add key verbsoe: true
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  projects.forEach((project) => {
    if (project.targets?.['test-ios']?.executor !== '@nrwl/detox:test') return;
    updateJestConfig(tree, project);
  });

  await formatFiles(tree);
}

function updateJestConfig(host: Tree, project: ProjectConfiguration) {
  const jestConfigPath = `${project.root}/jest.config.json`;
  if (!host.exists(jestConfigPath)) return;
  updateJson(host, jestConfigPath, (json) => {
    if (!json.verbose) {
      json.verbose = true;
    }
    return json;
  });
}
