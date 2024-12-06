import type { Tree } from '@nx/devkit';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import type {
  Language,
  NestGeneratorWithLanguageOption,
  NormalizedOptions,
  UnitTestRunner,
} from './types';

export async function normalizeOptions(
  tree: Tree,
  options: NestGeneratorWithLanguageOption,
  normalizationOptions: {
    allowedFileExtensions?: Array<'js' | 'ts'>;
    skipLanguageOption?: boolean;
    suffix?: string;
  } = {}
): Promise<NormalizedOptions> {
  const {
    allowedFileExtensions = ['js', 'ts'],
    skipLanguageOption = false,
    suffix,
  } = normalizationOptions;

  const { directory, artifactName, fileExtension } =
    await determineArtifactNameAndDirectoryOptions(tree, {
      path: options.path,
      allowedFileExtensions,
      fileExtension: options.language === 'js' ? 'js' : 'ts',
      js: options.language ? options.language === 'js' : undefined,
      jsOptionName: 'language',
    });

  options.path = undefined; // Now that we have `directory` we don't need `path`

  if (!skipLanguageOption) {
    // we assign the language based on the normalized file extension
    options.language = fileExtension as Language;
  }

  let name = artifactName;
  if (suffix && artifactName.endsWith(`.${suffix}`)) {
    // strip the suffix if it exists, the nestjs schematic will always add it
    name = artifactName.replace(`.${suffix}`, '');
  }

  return {
    ...options,
    flat: true,
    name,
    sourceRoot: directory,
  };
}

export function unitTestRunnerToSpec(
  unitTestRunner: UnitTestRunner | undefined
): boolean | undefined {
  return unitTestRunner !== undefined ? unitTestRunner === 'jest' : undefined;
}
