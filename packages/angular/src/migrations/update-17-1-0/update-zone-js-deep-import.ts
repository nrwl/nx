import { formatFiles, visitNotIgnoredFiles, type Tree } from '@nx/devkit';
import { getProjectsFilteredByDependencies } from '../utils/projects';

export default async function (tree: Tree) {
  const angularProjects = await getProjectsFilteredByDependencies(tree, [
    'npm:@angular/core',
  ]);

  if (!angularProjects.length) {
    return;
  }

  const zoneJsImportRegex = /(['"`])zone\.js\/dist\/zone(['"`])/g;
  const zoneJsTestingImportRegex =
    /(['"`])zone\.js\/dist\/zone-testing(['"`])/g;
  for (const { project } of angularProjects) {
    visitNotIgnoredFiles(tree, project.root, (file) => {
      // we are only interested in .ts files
      if (!file.endsWith('.ts')) {
        return;
      }

      let content = tree.read(file, 'utf-8');

      let wasUpdated = false;
      if (zoneJsImportRegex.test(content)) {
        content = content.replace(zoneJsImportRegex, '$1zone.js$2');
        wasUpdated = true;
      }
      if (zoneJsTestingImportRegex.test(content)) {
        content = content.replace(
          zoneJsTestingImportRegex,
          '$1zone.js/testing$2'
        );
        wasUpdated = true;
      }

      if (wasUpdated) {
        tree.write(file, content);
      }
    });
  }

  await formatFiles(tree);
}
