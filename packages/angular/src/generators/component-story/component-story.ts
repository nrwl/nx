import type { Tree } from '@nrwl/devkit';
import { formatFiles, generateFiles, joinPathFragments } from '@nrwl/devkit';
import { getComponentProps } from '../utils/storybook';
import { getArgsDefaultValue } from './lib/get-args-default-value';
import type { ComponentStoryGeneratorOptions } from './schema';

export function componentStoryGenerator(
  tree: Tree,
  options: ComponentStoryGeneratorOptions
): void {
  const { componentFileName, componentName, componentPath, projectPath } =
    options;

  const templatesDir = joinPathFragments(__dirname, 'files');
  const destinationDir = joinPathFragments(projectPath, componentPath);
  const storyFile = joinPathFragments(
    destinationDir,
    `${componentFileName}.stories.ts`
  );

  if (tree.exists(storyFile)) {
    return;
  }

  const props = getComponentProps(
    tree,
    joinPathFragments(destinationDir, `${componentFileName}.ts`),
    getArgsDefaultValue
  );

  generateFiles(tree, templatesDir, destinationDir, {
    componentFileName: componentFileName,
    componentName: componentName,
    props: props.filter((p) => typeof p.defaultValue !== 'undefined'),
    tmpl: '',
  });

  if (!options.skipFormat) {
    formatFiles(tree);
  }
}

export default componentStoryGenerator;
