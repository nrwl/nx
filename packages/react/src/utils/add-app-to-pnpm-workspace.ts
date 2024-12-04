import { detectPackageManager, readJson, Tree } from '@nx/devkit';

export function addProjectToTsSolutionWorkspace(
  tree: Tree,
  projectDir: string
) {
  if (detectPackageManager() === 'pnpm') {
    const { load, dump } = require('@zkochan/js-yaml');
    if (tree.exists('pnpm-workspace.yaml')) {
      const workspaceFile = tree.read('pnpm-workspace.yaml', 'utf-8');
      const yamlData = load(workspaceFile);

      if (!yamlData?.packages) {
        yamlData.packages = [];
      }

      if (!yamlData.packages.includes(projectDir)) {
        yamlData.packages.push(projectDir);
        tree.write('pnpm-workspace.yaml', dump(yamlData, { indent: 2 }));
      }
    }
  } else {
    // Update package.json
    const packageJson = readJson(tree, 'package.json');
    if (!packageJson.workspaces) {
      packageJson.workspaces = [];
    }
    if (!packageJson.workspaces.includes(projectDir)) {
      packageJson.workspaces.push(projectDir);
      tree.write('package.json', JSON.stringify(packageJson, null, 2));
    }
  }
}
