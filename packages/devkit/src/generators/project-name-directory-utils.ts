import { prompt } from 'enquirer';
import type { ProjectType } from 'nx/src/config/workspace-json-project-json';
import type { Tree } from 'nx/src/generators/tree';
import { requireNx } from '../../nx';
import {
  extractLayoutDirectory,
  getWorkspaceLayout,
} from '../utils/get-workspace-layout';
import { names } from '../utils/names';

const { joinPathFragments, readJson, readNxJson } = requireNx();

export type ProjectNameDirectoryFormat = 'as-provided' | 'derived';
export type ProjectGenerationOptions = {
  name: string;
  projectType: ProjectType;
  directory?: string;
  importPath?: string;
  nameDirectoryFormat?: ProjectNameDirectoryFormat;
  rootProject?: boolean;
};

export type ProjectNamesAndDirectories = {
  /**
   * Normalized full project name, including scope if name was provided with
   * scope (e.g., `@scope/name`, only available when `nameDirectoryFormat` is
   * `as-provided`).
   */
  projectName: string;
  /**
   * Normalized project directory, including the layout directory if configured.
   */
  projectDirectory: string;
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

type ProjectNameDirectoryFormats = {
  'as-provided': {
    description: string;
    options: ProjectNamesAndDirectories;
  };
  derived?: {
    description: string;
    options: ProjectNamesAndDirectories;
  };
};

export async function determineProjectNamesAndDirectories(
  tree: Tree,
  options: ProjectGenerationOptions
): Promise<ProjectNamesAndDirectories> {
  validateName(options.name, options.nameDirectoryFormat);
  const formats = getProjectNameDirectoryFormats(tree, options);
  const format =
    options.nameDirectoryFormat ?? (await determineFormat(formats));

  return formats[format].options;
}

function validateName(
  name: string,
  nameDirectoryFormat?: ProjectNameDirectoryFormat
): void {
  if (nameDirectoryFormat === 'derived' && name.startsWith('@')) {
    throw new Error(
      `The project name "${name}" cannot start with "@" when the "nameDirectoryFormat" is "derived".`
    );
  }

  const pattern = '(?:^@[a-zA-Z]+\\/[a-zA-Z]+|^[a-zA-Z]\\S*)$';
  const validationRegex = new RegExp(pattern);
  if (!validationRegex.test(name)) {
    throw new Error(
      `The project name should match the pattern "${pattern}". The provided value "${name}" does not match.`
    );
  }
}

async function determineFormat(
  formats: ProjectNameDirectoryFormats
): Promise<ProjectNameDirectoryFormat> {
  if (!formats.derived) {
    return 'as-provided';
  }

  if (process.env.NX_INTERACTIVE !== 'true') {
    return 'derived';
  }

  return await prompt<{ format: ProjectNameDirectoryFormat }>({
    type: 'select',
    name: 'format',
    message: 'What project name and directory format would you like to use?',
    choices: [
      {
        message: formats['as-provided'].description,
        name: 'as-provided',
      },
      {
        message: formats['derived'].description,
        name: 'derived',
      },
    ],
    initial: 'as-provided' as any,
  }).then(({ format }) => format);
}

function getProjectNameDirectoryFormats(
  tree: Tree,
  options: ProjectGenerationOptions
): ProjectNameDirectoryFormats {
  const name = names(options.name).fileName;
  const directory = options.directory?.replace(/^\.?\//, '');

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
        description: `${asProvidedProjectName} @ ${asProvidedProjectDirectory} (recommended)`,
        options: {
          projectName: asProvidedProjectName,
          names: {
            projectSimpleName: nameWithoutScope,
            projectFileName: nameWithoutScope,
          },
          importPath: asProvidedProjectName,
          projectDirectory: asProvidedProjectDirectory,
        },
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
  const derivedProjectName = options.rootProject
    ? name
    : derivedProjectDirectoryWithoutLayout.replace(/\//g, '-');
  const derivedSimpleProjectName = name;
  let derivedProjectDirectory = derivedProjectDirectoryWithoutLayout;
  if (!options.rootProject) {
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
      description: `${asProvidedProjectName} @ ${asProvidedProjectDirectory} (recommended)`,
      options: {
        projectName: asProvidedProjectName,
        names: {
          projectSimpleName: asProvidedProjectName,
          projectFileName: asProvidedProjectName,
        },
        importPath: asProvidedImportPath,
        projectDirectory: asProvidedProjectDirectory,
      },
    },
    derived: {
      description: `${derivedProjectName} @ ${derivedProjectDirectory} (legacy)`,
      options: {
        projectName: derivedProjectName,
        names: {
          projectSimpleName: derivedSimpleProjectName,
          projectFileName: derivedProjectName,
        },
        importPath: derivedImportPath,
        projectDirectory: derivedProjectDirectory,
      },
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
