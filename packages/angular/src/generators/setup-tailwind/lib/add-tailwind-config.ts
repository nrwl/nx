import {
  generateFiles,
  joinPathFragments,
  ProjectConfiguration,
  stripIndents,
  Tree,
} from '@nrwl/devkit';
import { relative } from 'path';
import { GeneratorOptions } from '../schema';

export function addTailwindConfig(
  tree: Tree,
  options: GeneratorOptions,
  project: ProjectConfiguration,
  tailwindVersion: '2' | '3'
): void {
  if (tree.exists(joinPathFragments(project.root, 'tailwind.config.js'))) {
    throw new Error(
      stripIndents`The "tailwind.config.js" file already exists in the project "${options.project}". Are you sure this is the right project to set up Tailwind?
      If you are sure, you can remove the existing file and re-run the generator.`
    );
  }

  const filesDir = tailwindVersion === '3' ? 'files/v3' : 'files/v2';

  generateFiles(
    tree,
    joinPathFragments(__dirname, '..', filesDir),
    project.root,
    {
      relativeSourceRoot: relative(project.root, project.sourceRoot),
      tmpl: '',
    }
  );
}
