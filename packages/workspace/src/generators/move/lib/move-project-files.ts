import { ProjectConfiguration, Tree, visitNotIgnoredFiles } from '@nx/devkit';
import { dirname, join, relative, sep } from 'path';
import { NormalizedSchema } from '../schema';

export const MOVED_JEST_CONFIG_EXTENSIONS = ['js', 'ts', 'cts'].join('|');

/**
 * Moves a project to the given destination path
 *
 * @param schema The options provided to the schematic
 */
export function moveProjectFiles(
  tree: Tree,
  schema: NormalizedSchema,
  project: ProjectConfiguration
) {
  // We don't want to move configuration files and other folders that we don't know about.
  // Moving the wrong files is worse than not moving them, because there might be
  // a lot of work to undo it.
  const knownRootProjectFiles = [
    // Config files
    'project.json',
    /^tsconfig(?!\.base\.json$)((\..+)?\.json$|json$)/,
    '.babelrc',
    '.eslintrc.json',
    'eslint.config.js',
    'eslint.config.cjs',
    new RegExp(
      `^jest\\.config\\.((app|lib)\\.)?(${MOVED_JEST_CONFIG_EXTENSIONS})$`
    ),
    /^vite\.config\.m?[jt]s$/,
    /^webpack.*\.js$/,
    'index.html', // Vite
  ];
  const knownRootProjectFolders = [
    'src', // Most apps/libs
    'app', // Remix, Next.js
    'pages', // Next.js
    'public', // Vite, Remix, Next.js
  ];

  const isKnownRootProjectFile = (file) => {
    const baseDir = dirname(file).split(sep)[0];
    if (baseDir === '.') {
      // Not nested, check file matches
      return knownRootProjectFiles.some((stringOrRegex) =>
        typeof stringOrRegex === 'string'
          ? file === stringOrRegex
          : stringOrRegex.test(file)
      );
    } else {
      // Nested, check base dir matches
      return knownRootProjectFolders.includes(baseDir);
    }
  };

  // The workspace Jest config runs every project's config, so it stays
  const isWorkspaceJestConfig = (file: string) =>
    new RegExp(`^jest\\.config\\.(${MOVED_JEST_CONFIG_EXTENSIONS})$`).test(
      file
    ) && tree.read(file, 'utf-8').includes('getJestProjectsAsync()');

  visitNotIgnoredFiles(tree, project.root, (file) => {
    if (
      project.root === '.' &&
      (!isKnownRootProjectFile(file) || isWorkspaceJestConfig(file))
    )
      return;

    // This is a rename but Angular Devkit isn't capable of writing to a file after it's renamed so this is a workaround
    let relativeFromOriginalSource = relative(project.root, file);
    if (project.root === '.') {
      // Before Nx 24, @nx/jest:configuration renamed a root project's config to `jest.config.app|lib`
      relativeFromOriginalSource = relativeFromOriginalSource.replace(
        new RegExp(
          `^jest\\.config\\.(app|lib)\\.(?=(${MOVED_JEST_CONFIG_EXTENSIONS})$)`
        ),
        'jest.config.'
      );
    }
    const newFilePath = join(
      schema.relativeToRootDestination,
      relativeFromOriginalSource
    );

    const content = tree.read(file);
    tree.write(newFilePath, content);
    tree.delete(file);
  });
}
