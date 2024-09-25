import {
  joinPathFragments,
  normalizePath,
  readJson,
  workspaceRoot,
  type ProjectType,
  type Tree,
} from 'nx/src/devkit-exports';
import { join, relative } from 'path';

// TODO(leo): remove in a follow up
export type ProjectNameAndRootFormat = 'as-provided';

export type ProjectGenerationOptions = {
  name: string;
  projectType: ProjectType;
  directory?: string;
  importPath?: string;
  rootProject?: boolean;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
};

export type ProjectNameAndRootOptions = {
  /**
   * Normalized full project name, including scope if name was provided with
   * scope (e.g., `@scope/name`, only available when `projectNameAndRootFormat`
   * is `as-provided`).
   */
  projectName: string;
  /**
   * Normalized project root, including the layout directory if configured.
   */
  projectRoot: string;
  names: {
    /**
     * Normalized project name without scope. It's meant to be used when
     * generating file names that contain the project name.
     */
    projectFileName: string;
    /**
     * Normalized project name without scope or directory. It's meant to be used
     * when generating shorter file names that contain the project name.
     */
    projectSimpleName: string;
  };
  /**
   * Normalized import path for the project.
   */
  importPath?: string;
};

export async function determineProjectNameAndRootOptions(
  tree: Tree,
  options: ProjectGenerationOptions
): Promise<
  ProjectNameAndRootOptions & {
    // TODO(leo): remove in a follow up
    projectNameAndRootFormat: ProjectNameAndRootFormat;
  }
> {
  validateName(options.name);
  const projectNameAndRootOptions = getProjectNameAndRootOptions(tree, options);

  return {
    ...projectNameAndRootOptions,
    projectNameAndRootFormat: 'as-provided',
  };
}

function validateName(name: string): void {
  /**
   * Matches two types of project names:
   *
   * 1. Valid npm package names (e.g., '@scope/name' or 'name').
   * 2. Names starting with a letter and can contain any character except whitespace and ':'.
   *
   * The second case is to support the legacy behavior (^[a-zA-Z].*$) with the difference
   * that it doesn't allow the ":" character. It was wrong to allow it because it would
   * conflict with the notation for tasks.
   */
  const pattern =
    '(?:^@[a-zA-Z0-9-*~][a-zA-Z0-9-*._~]*\\/[a-zA-Z0-9-~][a-zA-Z0-9-._~]*|^[a-zA-Z][^:]*)$';
  const validationRegex = new RegExp(pattern);
  if (!validationRegex.test(name)) {
    throw new Error(
      `The project name should match the pattern "${pattern}". The provided value "${name}" does not match.`
    );
  }
}

function getProjectNameAndRootOptions(
  tree: Tree,
  options: ProjectGenerationOptions
): ProjectNameAndRootOptions {
  const directory = options.directory
    ? normalizePath(options.directory.replace(/^\.?\//, ''))
    : undefined;

  const { name: asProvidedParsedName, directory: asProvidedParsedDirectory } =
    parseNameForAsProvided(options.name);

  if (asProvidedParsedDirectory && directory) {
    throw new Error(
      `You can't specify both a directory (${options.directory}) and a name with a directory path (${options.name}). ` +
        `Please specify either a directory or a name with a directory path.`
    );
  }

  const asProvidedOptions = getAsProvidedOptions(tree, {
    ...options,
    directory: directory ?? asProvidedParsedDirectory,
    name: asProvidedParsedName,
  });

  return asProvidedOptions;
}

function getAsProvidedOptions(
  tree: Tree,
  options: ProjectGenerationOptions
): ProjectNameAndRootOptions {
  let projectSimpleName: string;
  let projectFileName: string;
  if (options.name.startsWith('@')) {
    const [_scope, ...rest] = options.name.split('/');
    projectFileName = rest.join('-');
    projectSimpleName = rest.pop();
  } else {
    projectSimpleName = options.name;
    projectFileName = options.name;
  }

  let projectRoot: string;
  const relativeCwd = getRelativeCwd();

  if (options.directory) {
    // append the directory to the current working directory if it doesn't start with it
    if (
      options.directory === relativeCwd ||
      options.directory.startsWith(`${relativeCwd}/`)
    ) {
      projectRoot = options.directory;
    } else {
      projectRoot = joinPathFragments(relativeCwd, options.directory);
    }
  } else if (options.rootProject) {
    projectRoot = '.';
  } else {
    projectRoot = relativeCwd;
    // append the project name to the current working directory if it doesn't end with it
    if (!relativeCwd.endsWith(options.name)) {
      projectRoot = joinPathFragments(relativeCwd, options.name);
    }
  }

  let importPath: string | undefined = undefined;
  if (options.projectType === 'library') {
    importPath = options.importPath;

    if (!importPath) {
      if (options.name.startsWith('@')) {
        importPath = options.name;
      } else {
        const npmScope = getNpmScope(tree);
        importPath =
          projectRoot === '.'
            ? readJson<{ name?: string }>(tree, 'package.json').name ??
              getImportPath(npmScope, options.name)
            : getImportPath(npmScope, options.name);
      }
    }
  }

  return {
    projectName: options.name,
    names: {
      projectSimpleName,
      projectFileName,
    },
    importPath,
    projectRoot,
  };
}

function getImportPath(npmScope: string | undefined, name: string) {
  return npmScope ? `${npmScope === '@' ? '' : '@'}${npmScope}/${name}` : name;
}

function getNpmScope(tree: Tree): string | undefined {
  const { name } = tree.exists('package.json')
    ? readJson<{ name?: string }>(tree, 'package.json')
    : { name: null };

  return name?.startsWith('@') ? name.split('/')[0].substring(1) : undefined;
}

/**
 * When running a script with the package manager (e.g. `npm run`), the package manager will
 * traverse the directory tree upwards until it finds a `package.json` and will set `process.cwd()`
 * to the folder where it found it. The actual working directory is stored in the INIT_CWD
 * environment variable (see here: https://docs.npmjs.com/cli/v9/commands/npm-run-script#description).
 */
function getCwd(): string {
  return process.env.INIT_CWD?.startsWith(workspaceRoot)
    ? process.env.INIT_CWD
    : process.cwd();
}

function getRelativeCwd(): string {
  return normalizePath(relative(workspaceRoot, getCwd())).replace(/\/$/, '');
}

/**
 * Function for setting cwd during testing
 */
export function setCwd(path: string): void {
  process.env.INIT_CWD = join(workspaceRoot, path);
}

function parseNameForAsProvided(rawName: string): {
  name: string;
  directory: string | undefined;
} {
  const directory = normalizePath(rawName);

  if (rawName.includes('@')) {
    const index = directory.lastIndexOf('@');

    if (index === 0) {
      return { name: rawName, directory: undefined };
    }

    const name = directory.substring(index);

    return { name, directory };
  }

  if (rawName.includes('/')) {
    const index = directory.lastIndexOf('/');
    const name = directory.substring(index + 1);

    return { name, directory };
  }

  return { name: rawName, directory: undefined };
}
