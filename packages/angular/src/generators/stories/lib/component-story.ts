import type { Tree } from '@nx/devkit';
import { formatFiles, generateFiles, joinPathFragments } from '@nx/devkit';
import { getComponentProps } from '../../utils/storybook-ast/storybook-inputs';

export interface ComponentStoryOptions {
  projectPath: string;
  interactionTests?: boolean;
  componentName: string;
  componentPath: string;
  componentFileName: string;
  skipFormat?: boolean;
}

export async function createComponentStory(
  tree: Tree,
  options: ComponentStoryOptions
): Promise<void> {
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
    joinPathFragments(destinationDir, `${componentFileName}.ts`)
  );

  generateFiles(tree, templatesDir, destinationDir, {
    componentFileName: componentFileName,
    componentName: componentName,
    componentNameSimple: componentFileName.replace('.component', ''),
    interactionTests: options.interactionTests,
    props: props.filter((p) => typeof p.defaultValue !== 'undefined'),
    tmpl: '',
  });

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}
