import { prompt } from 'enquirer';
import type { ProjectType } from 'nx/src/config/workspace-json-project-json';
import type { Tree } from 'nx/src/generators/tree';
import { join, relative } from 'path';
import { requireNx } from '../../nx';
import {
  extractLayoutDirectory,
  getWorkspaceLayout,
} from '../utils/get-workspace-layout';
import { names } from '../utils/names';

const {
  joinPathFragments,
  logger,
  normalizePath,
  output,
  readJson,
  stripIndents,
  workspaceRoot,
} = requireNx();

export type ProjectNameAndRootFormat = 'as-provided' | 'derived';
export type ProjectGenerationOptions = {
  name: string;
  projectType: ProjectType;
  callingGenerator: string | null;
  directory?: string;
  importPath?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  rootProject?: boolean;
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

type ProjectNameAndRootFormats = {
  'as-provided': ProjectNameAndRootOptions;
  derived?: ProjectNameAndRootOptions;
};

export async function determineProjectNameAndRootOptions(
  tree: Tree,
  options: ProjectGenerationOptions
): Promise<
  ProjectNameAndRootOptions & {
    projectNameAndRootFormat: ProjectNameAndRootFormat;
  }
> {
  if (
    !options.projectNameAndRootFormat &&
    (process.env.NX_INTERACTIVE !== 'true' || !isTTY())
  ) {
    options.projectNameAndRootFormat = 'derived';
  }

  validateName(options.name, options.projectNameAndRootFormat);
  const formats = getProjectNameAndRootFormats(tree, options);

  const format =
    options.projectNameAndRootFormat ?? (await determineFormat(formats));

  if (format === 'derived' && options.callingGenerator) {
    logDeprecationMessage(options.callingGenerator, formats);
  }

  return {
    ...formats[format],
    projectNameAndRootFormat: format,
  };
}

function validateName(
  name: string,
  projectNameAndRootFormat?: ProjectNameAndRootFormat
): void {
  if (projectNameAndRootFormat === 'derived' && name.startsWith('@')) {
    throw new Error(
      `The project name "${name}" cannot start with "@" when the "projectNameAndRootFormat" is "derived".`
    );
  }

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

function logDeprecationMessage(
  callingGenerator: string,
  formats: ProjectNameAndRootFormats
) {
  logger.warn(stripIndents`
    In Nx 19, generating projects will no longer derive the name and root.
    Please provide the exact project name and root in the future.
    Example: nx g ${callingGenerator} ${formats['derived'].projectName} --directory ${formats['derived'].projectRoot}
  `);
}

async function determineFormat(
  formats: ProjectNameAndRootFormats
): Promise<ProjectNameAndRootFormat> {
  if (!formats.derived) {
    return 'as-provided';
  }

  const asProvidedDescription = `As provided:
    Name: ${formats['as-provided'].projectName}
    Root: ${formats['as-provided'].projectRoot}`;
  const asProvidedSelectedValue = `${formats['as-provided'].projectName} @ ${formats['as-provided'].projectRoot}`;
  const derivedDescription = `Derived:
    Name: ${formats['derived'].projectName}
    Root: ${formats['derived'].projectRoot}`;
  const derivedSelectedValue = `${formats['derived'].projectName} @ ${formats['derived'].projectRoot}`;

  if (asProvidedSelectedValue === derivedSelectedValue) {
    return 'as-provided';
  }

  const result = await prompt<{ format: ProjectNameAndRootFormat }>({
    type: 'select',
    name: 'format',
    message:
      'What should be the project name and where should it be generated?',
    choices: [
      {
        message: asProvidedDescription,
        name: asProvidedSelectedValue,
      },
      {
        message: derivedDescription,
        name: derivedSelectedValue,
      },
    ],
    initial: 0,
  }).then(({ format }) =>
    format === asProvidedSelectedValue ? 'as-provided' : 'derived'
  );

  return result;
}

function getProjectNameAndRootFormats(
  tree: Tree,
  options: ProjectGenerationOptions
): ProjectNameAndRootFormats {
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

  if (options.projectNameAndRootFormat === 'as-provided') {
    return {
      'as-provided': asProvidedOptions,
      derived: undefined,
    };
  }

  if (asProvidedOptions.projectName.startsWith('@')) {
    if (!options.projectNameAndRootFormat) {
      output.warn({
        title: `The provided name "${options.name}" contains a scoped project name and this is not supported by the "${options.callingGenerator}" when using the "derived" format.`,
        bodyLines: [
          `The generator will try to generate the project "${asProvidedOptions.projectName}" using the "as-provided" format at "${asProvidedOptions.projectRoot}".`,
        ],
      });

      return {
        'as-provided': asProvidedOptions,
        derived: undefined,
      };
    }

    throw new Error(
      `The provided name "${options.name}" contains a scoped project name and this is not supported by the "${options.callingGenerator}" when using the "derived" format. ` +
        `Please provide a name without "@" or use the "as-provided" format.`
    );
  }

  const { name: derivedParsedName, directory: derivedParsedDirectory } =
    parseNameForDerived(options.name);
  const derivedOptions = getDerivedOptions(tree, {
    ...options,
    directory: directory ?? derivedParsedDirectory,
    name: derivedParsedName,
  });

  return {
    'as-provided': asProvidedOptions,
    derived: derivedOptions,
  };
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

function getDerivedOptions(
  tree: Tree,
  options: ProjectGenerationOptions
): ProjectNameAndRootOptions {
  const name = names(options.name).fileName;
  let { projectDirectory, layoutDirectory } = getDirectories(
    tree,
    options.directory,
    options.projectType
  );
  const projectDirectoryWithoutLayout = projectDirectory
    ? `${names(projectDirectory).fileName}/${name}`
    : options.rootProject
    ? '.'
    : name;
  // the project name uses the directory without the layout directory
  const projectName =
    projectDirectoryWithoutLayout === '.'
      ? name
      : projectDirectoryWithoutLayout.replace(/\//g, '-');
  const projectSimpleName = name;
  let projectRoot = projectDirectoryWithoutLayout;
  if (projectDirectoryWithoutLayout !== '.') {
    // prepend the layout directory
    projectRoot = joinPathFragments(layoutDirectory, projectRoot);
  }

  let importPath: string;
  if (options.projectType === 'library') {
    importPath = options.importPath;
    if (!importPath) {
      const npmScope = getNpmScope(tree);
      importPath =
        projectRoot === '.'
          ? readJson<{ name?: string }>(tree, 'package.json').name ??
            getImportPath(npmScope, projectName)
          : getImportPath(npmScope, projectDirectoryWithoutLayout);
    }
  }

  return {
    projectName,
    names: {
      projectSimpleName,
      projectFileName: projectName,
    },
    importPath,
    projectRoot,
  };
}

function getDirectories(
  tree: Tree,
  directory: string | undefined,
  projectType: ProjectType
): {
  projectDirectory: string;
  layoutDirectory: string;
} {
  let { projectDirectory, layoutDirectory } = extractLayoutDirectory(directory);
  if (!layoutDirectory) {
    const { appsDir, libsDir } = getWorkspaceLayout(tree);
    layoutDirectory = projectType === 'application' ? appsDir : libsDir;
  }

  return { projectDirectory, layoutDirectory };
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

function isTTY(): boolean {
  return !!process.stdout.isTTY && process.env['CI'] !== 'true';
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

function parseNameForDerived(rawName: string): {
  name: string;
  directory: string | undefined;
} {
  const parsedName = normalizePath(rawName).split('/');
  const name = parsedName.pop();
  const directory = parsedName.length ? parsedName.join('/') : undefined;

  return { name, directory };
}
