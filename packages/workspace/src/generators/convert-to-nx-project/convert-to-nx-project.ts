import {
  convertNxGenerator,
  formatFiles,
  getProjects,
  getWorkspacePath,
  logger,
  NxJsonConfiguration,
  NxJsonProjectConfiguration,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
  updateWorkspaceConfiguration,
  writeJson,
} from '@nrwl/devkit';

import {join} from 'path';

import { Schema } from './schema';
import { checkIfNxProjectFileExists } from './utils/check-if-nx-project-file-exists';
import { getProjectConfigurationPath } from './utils/get-project-configuration-path';

export const SCHEMA_OPTIONS_ARE_MUTUALLY_EXCLUSIVE =
  '--project and --all are mutually exclusive';
export const PROJECT_OR_ALL_IS_REQUIRED =
  '--project or --all must be specified';

export function validateSchema(schema: Schema) {
  if (schema.project && schema.all) {
    throw SCHEMA_OPTIONS_ARE_MUTUALLY_EXCLUSIVE;
  }

  if (!schema.project && !schema.all) {
    throw PROJECT_OR_ALL_IS_REQUIRED;
  }
}

export async function convertToNxProjectGenerator(host: Tree, schema: Schema) {
  validateSchema(schema);

  const projects = schema.all
    ? getProjects(host).entries()
    : ([[schema.project, readProjectConfiguration(host, schema.project)]] as [
        string,
        ProjectConfiguration & NxJsonProjectConfiguration
      ][]);

  for (const [project, configuration] of projects) {
    if (checkIfNxProjectFileExists(host, configuration)) {
      logger.warn(`Skipping ${project} since ${configuration}`);
      continue;
    }
    const configPath = getProjectConfigurationPath(configuration);

    writeJson(host, configPath, configuration);

    updateJson(host, getWorkspacePath(host), (value) => {
      value.projects[project] = configPath;
      return value;
    })

    updateJson(host, 'nx.json', (value: NxJsonConfiguration) => {
      delete value.projects[project]
      return value;
    })
  } 

  await formatFiles(host);
}

export default convertToNxProjectGenerator;

export const convertToNxProjectSchematic = convertNxGenerator(
  convertToNxProjectGenerator
);
