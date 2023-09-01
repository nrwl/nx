import { prompt } from 'enquirer';
import type { ProjectType } from 'nx/src/config/workspace-json-project-json';
import type { Tree } from 'nx/src/generators/tree';
import { requireNx } from '../../nx';
import {
  extractLayoutDirectory,
  getWorkspaceLayout,
} from '../utils/get-workspace-layout';
import { names } from '../utils/names';

const {
  joinPathFragments,
  normalizePath,
  logger,
  readJson,
  readNxJson,
  updateNxJson,
  stripIndents,
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
  validateName(options.name, options.projectNameAndRootFormat);
  const formats = getProjectNameAndRootFormats(tree, options);
  const format =
    options.projectNameAndRootFormat ??
    (getDefaultProjectNameAndRootFormat(tree) === 'as-provided'
      ? 'as-provided'
      : await determineFormat(tree, formats, options.callingGenerator));

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

async function determineFormat(
  tree: Tree,
  formats: ProjectNameAndRootFormats,
  callingGenerator: string | null
): Promise<ProjectNameAndRootFormat> {
  if (!formats.derived) {
    return 'as-provided';
  }

  if (process.env.NX_INTERACTIVE !== 'true' || !isTTY()) {
    return 'derived';
  }

  const asProvidedDescription = `As provided:
    Name: ${formats['as-provided'].projectName}
    Root: ${formats['as-provided'].projectRoot}`;
  const asProvidedSelectedValue = `${formats['as-provided'].projectName} @ ${formats['as-provided'].projectRoot}`;
  const derivedDescription = `Derived:
    Name: ${formats['derived'].projectName}
    Root: ${formats['derived'].projectRoot}`;
  const derivedSelectedValue = `${formats['derived'].projectName} @ ${formats['derived'].projectRoot}`;

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
    initial: 'as-provided' as any,
  }).then(({ format }) =>
    format === asProvidedSelectedValue ? 'as-provided' : 'derived'
  );

  const deprecationWarning = stripIndents`
    In Nx 18, generating projects will no longer derive the name and root.
    Please provide the exact project name and root in the future.`;

  if (result === 'as-provided' && callingGenerator) {
    const { saveDefault } = await prompt<{ saveDefault: boolean }>({
      type: 'confirm',
      message: `Would you like to configure Nx to always take project name and root as provided for ${callingGenerator}?`,
      name: 'saveDefault',
      initial: true,
    });
    if (saveDefault) {
      setProjectNameAndRootFormatDefault(tree);
    } else {
      logger.warn(deprecationWarning);
    }
  } else {
    const example = `Example: nx g ${callingGenerator} ${formats[result].projectName} --directory ${formats[result].projectRoot}`;
    logger.warn(deprecationWarning + '\n' + example);
  }

  return result;
}

function setProjectNameAndRootFormatDefault(tree: Tree) {
  const nxJson = readNxJson(tree);
  nxJson.workspaceLayout ??= {};
  nxJson.workspaceLayout.projectNameAndRootFormat = 'as-provided';
  updateNxJson(tree, nxJson);
}

function getDefaultProjectNameAndRootFormat(tree: Tree) {
  const nxJson = readNxJson(tree);
  return nxJson.workspaceLayout?.projectNameAndRootFormat ?? 'derived';
}

function getProjectNameAndRootFormats(
  tree: Tree,
  options: ProjectGenerationOptions
): ProjectNameAndRootFormats {
  const name = names(options.name).fileName;
  const directory = options.directory
    ? normalizePath(options.directory.replace(/^\.?\//, ''))
    : undefined;

  const asProvidedProjectName = name;
  const asProvidedProjectDirectory = directory
    ? names(directory).fileName
    : options.rootProject
    ? '.'
    : asProvidedProjectName;

  if (name.startsWith('@')) {
    const nameWithoutScope = asProvidedProjectName.split('/')[1];
    return {
      'as-provided': {
        projectName: asProvidedProjectName,
        names: {
          projectSimpleName: nameWithoutScope,
          projectFileName: nameWithoutScope,
        },
        importPath: options.importPath ?? asProvidedProjectName,
        projectRoot: asProvidedProjectDirectory,
      },
    };
  }

  let asProvidedImportPath: string;
  let npmScope: string;
  if (options.projectType === 'library') {
    asProvidedImportPath = options.importPath;
    if (!asProvidedImportPath) {
      npmScope = getNpmScope(tree);
      asProvidedImportPath =
        asProvidedProjectDirectory === '.'
          ? readJson<{ name?: string }>(tree, 'package.json').name ??
            getImportPath(npmScope, asProvidedProjectName)
          : getImportPath(npmScope, asProvidedProjectName);
    }
  }

  let { projectDirectory, layoutDirectory } = getDirectories(
    tree,
    directory,
    options.projectType
  );
  const derivedProjectDirectoryWithoutLayout = projectDirectory
    ? `${names(projectDirectory).fileName}/${name}`
    : options.rootProject
    ? '.'
    : name;
  // the project name uses the directory without the layout directory
  const derivedProjectName =
    derivedProjectDirectoryWithoutLayout === '.'
      ? name
      : derivedProjectDirectoryWithoutLayout.replace(/\//g, '-');
  const derivedSimpleProjectName = name;
  let derivedProjectDirectory = derivedProjectDirectoryWithoutLayout;
  if (derivedProjectDirectoryWithoutLayout !== '.') {
    // prepend the layout directory
    derivedProjectDirectory = joinPathFragments(
      layoutDirectory,
      derivedProjectDirectory
    );
  }

  let derivedImportPath: string;
  if (options.projectType === 'library') {
    derivedImportPath = options.importPath;
    if (!derivedImportPath) {
      derivedImportPath =
        derivedProjectDirectory === '.'
          ? readJson<{ name?: string }>(tree, 'package.json').name ??
            getImportPath(npmScope, derivedProjectName)
          : getImportPath(npmScope, derivedProjectDirectoryWithoutLayout);
    }
  }

  return {
    'as-provided': {
      projectName: asProvidedProjectName,
      names: {
        projectSimpleName: asProvidedProjectName,
        projectFileName: asProvidedProjectName,
      },
      importPath: asProvidedImportPath,
      projectRoot: asProvidedProjectDirectory,
    },
    derived: {
      projectName: derivedProjectName,
      names: {
        projectSimpleName: derivedSimpleProjectName,
        projectFileName: derivedProjectName,
      },
      importPath: derivedImportPath,
      projectRoot: derivedProjectDirectory,
    },
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
  const nxJson = readNxJson(tree);

  // TODO(v17): Remove reading this from nx.json
  if (nxJson?.npmScope) {
    return nxJson.npmScope;
  }

  const { name } = tree.exists('package.json')
    ? readJson<{ name?: string }>(tree, 'package.json')
    : { name: null };

  return name?.startsWith('@') ? name.split('/')[0].substring(1) : undefined;
}

function isTTY(): boolean {
  return !!process.stdout.isTTY && process.env['CI'] !== 'true';
}
