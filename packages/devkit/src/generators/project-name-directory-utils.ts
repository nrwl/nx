import { prompt } from 'enquirer';
import type { ProjectType } from 'nx/src/config/workspace-json-project-json';
import type { Tree } from 'nx/src/generators/tree';
import { requireNx } from '../../nx';
import {
  extractLayoutDirectory,
  getWorkspaceLayout,
} from '../utils/get-workspace-layout';
import { names } from '../utils/names';

const { joinPathFragments } = requireNx();

export type ProjectNameDirectoryFormat = 'as-provided' | 'derived';
export type ProjectGenerationOptions = {
  name: string;
  projectType: ProjectType;
  directory?: string;
  nameDirectoryFormat?: ProjectNameDirectoryFormat;
  rootProject?: boolean;
};
export type ProjectNameDirectory = {
  projectName: string;
  projectDirectory: string;
  projectDirectoryWithoutLayout: string;
};

type ProjectNameDirectoryFormats = {
  'as-provided': {
    description: string;
    options: ProjectNameDirectory;
  };
  derived?: {
    description: string;
    options: ProjectNameDirectory;
  };
};

export async function determineProjectNameDirectory(
  tree: Tree,
  options: ProjectGenerationOptions
): Promise<ProjectNameDirectory> {
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

  const pattern = '^(@[a-zA-Z]+\\/[a-zA-Z]|[a-zA-Z]).*$';
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
  // TODO(leo): should we validate whether there's already a project in the root?
  const asProvidedProjectDirectory = directory
    ? names(directory).fileName
    : '.';

  if (name.startsWith('@')) {
    return {
      'as-provided': {
        description: `${asProvidedProjectName} @ ${asProvidedProjectDirectory} (preferred)`,
        options: {
          projectName: asProvidedProjectName,
          projectDirectory: asProvidedProjectDirectory,
          projectDirectoryWithoutLayout: asProvidedProjectDirectory,
        },
      },
    };
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
  let derivedProjectDirectory = derivedProjectDirectoryWithoutLayout;
  if (!options.rootProject) {
    // prepend the layout directory
    derivedProjectDirectory = joinPathFragments(
      layoutDirectory,
      derivedProjectDirectory
    );
  }

  return {
    'as-provided': {
      description: `${asProvidedProjectName} @ ${asProvidedProjectDirectory} (preferred)`,
      options: {
        projectName: asProvidedProjectName,
        projectDirectory: asProvidedProjectDirectory,
        projectDirectoryWithoutLayout: asProvidedProjectDirectory,
      },
    },
    derived: {
      description: `${derivedProjectName} @ ${derivedProjectDirectory} (legacy)`,
      options: {
        projectName: derivedProjectName,
        projectDirectory: derivedProjectDirectory,
        projectDirectoryWithoutLayout: derivedProjectDirectoryWithoutLayout,
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
