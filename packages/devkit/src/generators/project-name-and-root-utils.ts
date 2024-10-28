import { prompt } from 'enquirer';
import {
  joinPathFragments,
  normalizePath,
  type ProjectType,
  readJson,
  type Tree,
  workspaceRoot,
} from 'nx/src/devkit-exports';
import { relative } from 'path';

export type ProjectGenerationOptions = {
  directory: string;
  name?: string;
  projectType: ProjectType;
  importPath?: string;
  rootProject?: boolean;
};

export type ProjectNameAndRootOptions = {
  /**
   * Normalized full project name, including scope if name was provided with
   * scope (e.g., `@scope/name`)
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
): Promise<ProjectNameAndRootOptions> {
  validateOptions(options);

  const directory = normalizePath(options.directory);
  const name =
    options.name ??
    directory.match(/(@[^@/]+(\/[^@/]+)+)/)?.[1] ??
    directory.substring(directory.lastIndexOf('/') + 1);

  let projectSimpleName: string;
  let projectFileName: string;
  if (name.startsWith('@')) {
    const [_scope, ...rest] = name.split('/');
    projectFileName = rest.join('-');
    projectSimpleName = rest.pop();
  } else {
    projectSimpleName = name;
    projectFileName = name;
  }

  let projectRoot: string;
  const relativeCwd = getRelativeCwd();

  if (directory) {
    // append the directory to the current working directory if it doesn't start with it
    if (directory === relativeCwd || directory.startsWith(`${relativeCwd}/`)) {
      projectRoot = directory;
    } else {
      projectRoot = joinPathFragments(relativeCwd, directory);
    }
  } else if (options.rootProject) {
    projectRoot = '.';
  } else {
    projectRoot = relativeCwd;
    // append the project name to the current working directory if it doesn't end with it
    if (!relativeCwd.endsWith(name)) {
      projectRoot = joinPathFragments(relativeCwd, name);
    }
  }

  let importPath: string | undefined = undefined;
  if (options.projectType === 'library') {
    importPath = options.importPath;

    if (!importPath) {
      if (name.startsWith('@')) {
        importPath = name;
      } else {
        const npmScope = getNpmScope(tree);
        importPath =
          projectRoot === '.'
            ? readJson<{ name?: string }>(tree, 'package.json').name ??
              getImportPath(npmScope, name)
            : getImportPath(npmScope, name);
      }
    }
  }

  return {
    projectName: name,
    names: {
      projectSimpleName,
      projectFileName,
    },
    importPath,
    projectRoot,
  };
}

export async function ensureProjectName(
  tree: Tree,
  options: Omit<ProjectGenerationOptions, 'projectType'>,
  projectType: 'application' | 'library'
): Promise<void> {
  if (!options.name) {
    if (options.directory === '.' && getRelativeCwd() === '') {
      const result = await prompt<{ name: string }>({
        type: 'input',
        name: 'name',
        message: `What do you want to name the ${projectType}?`,
      }).then(({ name }) => (options.name = name));
    }
    const { projectName } = await determineProjectNameAndRootOptions(tree, {
      ...options,
      projectType,
    });
    options.name = projectName;
  }
}

function validateOptions(options: ProjectGenerationOptions): void {
  if (options.directory === '.') {
    /**
     * Root projects must provide name option
     */
    if (!options.name) {
      throw new Error(`Root projects must also specify name option.`);
    }
  } else {
    /**
     * Both directory and name (if present) must match one of two cases:
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
    if (options.name && !validationRegex.test(options.name)) {
      throw new Error(
        `The name should match the pattern "${pattern}". The provided value "${options.name}" does not match.`
      );
    }
    if (!validationRegex.test(options.directory)) {
      throw new Error(
        `The directory should match the pattern "${pattern}". The provided value "${options.directory}" does not match.`
      );
    }
  }
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
