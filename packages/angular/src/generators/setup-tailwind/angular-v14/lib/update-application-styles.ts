import {
  joinPathFragments,
  ProjectConfiguration,
  stripIndents,
  Tree,
} from '@nrwl/devkit';
import { NormalizedGeneratorOptions } from '../schema';

export function updateApplicationStyles(
  tree: Tree,
  options: NormalizedGeneratorOptions,
  project: ProjectConfiguration
): void {
  let stylesEntryPoint = options.stylesEntryPoint;

  if (stylesEntryPoint && !tree.exists(stylesEntryPoint)) {
    throw new Error(
      `The provided styles entry point "${stylesEntryPoint}" could not be found.`
    );
  }

  if (!stylesEntryPoint) {
    stylesEntryPoint = findStylesEntryPoint(tree, options, project);

    if (!stylesEntryPoint) {
      throw new Error(
        stripIndents`Could not find a styles entry point for project "${options.project}".
        Please specify a styles entry point using the "--stylesEntryPoint" option.`
      );
    }
  }

  const stylesEntryPointContent = tree.read(stylesEntryPoint, 'utf-8');
  tree.write(
    stylesEntryPoint,
    stripIndents`@tailwind base;
    @tailwind components;
    @tailwind utilities;

    ${stylesEntryPointContent}`
  );
}

function findStylesEntryPoint(
  tree: Tree,
  options: NormalizedGeneratorOptions,
  project: ProjectConfiguration
): string | undefined {
  // first check for common names
  const possibleStylesEntryPoints = [
    joinPathFragments(project.sourceRoot ?? project.root, 'styles.css'),
    joinPathFragments(project.sourceRoot ?? project.root, 'styles.scss'),
    joinPathFragments(project.sourceRoot ?? project.root, 'styles.sass'),
    joinPathFragments(project.sourceRoot ?? project.root, 'styles.less'),
  ];

  let stylesEntryPoint = possibleStylesEntryPoints.find((s) => tree.exists(s));
  if (stylesEntryPoint) {
    return stylesEntryPoint;
  }

  // then check for the specified styles in the build configuration if it exists
  const styles: Array<string | { input: string; inject: boolean }> =
    project.targets?.[options.buildTarget].options?.styles;

  if (!styles) {
    return undefined;
  }

  // find the first style that belongs to the project source
  const style = styles.find((s) =>
    typeof s === 'string'
      ? s.startsWith(project.root) && tree.exists(s)
      : s.input.startsWith(project.root) &&
        s.inject !== false &&
        tree.exists(s.input)
  );

  if (!style) {
    return undefined;
  }

  return typeof style === 'string' ? style : style.input;
}
