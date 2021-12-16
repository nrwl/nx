import {
  generateFiles,
  joinPathFragments,
  ProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { relative } from 'path';

export function addTailwindConfig(
  tree: Tree,
  project: ProjectConfiguration,
  tailwindVersion: '2' | '3'
): void {
  const filesDir = tailwindVersion === '3' ? 'files/v3' : 'files/v2';

  generateFiles(
    tree,
    joinPathFragments(__dirname, '..', filesDir),
    project.root,
    {
      projectType: project.projectType,
      relativeSourceRoot: relative(project.root, project.sourceRoot),
      tmpl: '',
    }
  );
}
