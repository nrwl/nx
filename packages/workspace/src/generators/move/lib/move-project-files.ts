import { ProjectConfiguration, Tree, visitNotIgnoredFiles } from '@nx/devkit';
import { dirname, join, relative, sep } from 'path';
import { NormalizedSchema } from '../schema';

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
    /^jest\.config\.((app|lib)\.)?[jt]s$/,
    'vite.config.ts',
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

  visitNotIgnoredFiles(tree, project.root, (file) => {
    if (project.root === '.' && !isKnownRootProjectFile(file)) return;

    // This is a rename but Angular Devkit isn't capable of writing to a file after it's renamed so this is a workaround
    const relativeFromOriginalSource = relative(project.root, file);
    const newFilePath = join(
      schema.relativeToRootDestination,
      relativeFromOriginalSource
    );

    const content = tree.read(file);
    tree.write(newFilePath, content);
    tree.delete(file);
  });
}
