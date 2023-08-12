import { Tree, generateFiles, joinPathFragments } from '@nx/devkit';
import { NormalizedSchema } from '../schema';

interface Names {
  name: string;
  className: string;
  propertyName: string;
  constantName: string;
  fileName: string;
}

export async function createFiles(
  tree: Tree,
  options: NormalizedSchema,
  componentNames: Names,
  typeNames: Names
) {
  const directory = getDirFromOptions(options);

  generateFiles(
    tree,
    joinPathFragments(__dirname, '../files', directory),
    options.directory,
    {
      fileName: componentNames.fileName,
      className: componentNames.className,
      type: typeNames.fileName,
      typeClassName: typeNames.className,
      withHost: options.withHost,
      withCustomHost: options.withCustomHost,
      jest: options.jest,
      tpl: '',
    }
  );

  if (options.skipTests) {
    const pathToSpecFile = joinPathFragments(
      options.directory,
      `${componentNames.fileName}.${typeNames.fileName}.spec.ts`
    );

    tree.delete(pathToSpecFile);
  }
}

function getDirFromOptions(options: NormalizedSchema): string {
  if (options.withCustomHost) {
    return 'component-custom-host';
  }

  if (options.withHost) {
    return 'component-host';
  }

  return 'component';
}
