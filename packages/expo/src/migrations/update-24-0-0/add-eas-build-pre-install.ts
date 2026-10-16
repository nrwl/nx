import {
  formatFiles,
  getProjects,
  joinPathFragments,
  offsetFromRoot,
  readJson,
  updateJson,
  type Tree,
} from '@nx/devkit';
import type { PackageJson } from '@nx/devkit/internal';
import {
  addEasBuildPreInstallScript,
  easBuildPreInstallScriptPath,
} from '../../generators/application/lib/add-eas-scripts';

const hookName = 'eas-build-pre-install';

export default async function update(tree: Tree) {
  const conflicts: string[] = [];
  let changed = false;

  for (const [, project] of getProjects(tree)) {
    const packageJsonPath = joinPathFragments(project.root, 'package.json');
    if (
      !tree.exists(joinPathFragments(project.root, 'eas.json')) ||
      !tree.exists(packageJsonPath)
    ) {
      continue;
    }

    const hookCommand = `cd ${offsetFromRoot(project.root)} && node ${easBuildPreInstallScriptPath} . ${project.root}`;
    const existing = readJson<PackageJson>(tree, packageJsonPath).scripts?.[
      hookName
    ];
    if (existing === hookCommand) {
      continue;
    }
    if (existing) {
      conflicts.push(
        `${packageJsonPath} already defines "${hookName}". Make it also run "${hookCommand}".`
      );
      continue;
    }

    updateJson<PackageJson>(tree, packageJsonPath, (json) => {
      json.scripts = { ...json.scripts, [hookName]: hookCommand };
      return json;
    });
    addEasBuildPreInstallScript(tree);
    changed = true;
  }

  if (changed) {
    await formatFiles(tree);
  }

  if (conflicts.length) {
    return { nextSteps: conflicts, agentContext: conflicts.join('\n') };
  }
  return { skipAgentic: true };
}
