import { dirname } from 'path';
import { prompt } from 'enquirer';

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
  writeJson,
} from '@nrwl/devkit';

import { Schema } from './schema';
import { getProjectConfigurationPath } from './utils/get-project-configuration-path';

export const SCHEMA_OPTIONS_ARE_MUTUALLY_EXCLUSIVE =
  '--project and --all are mutually exclusive';

export async function validateSchema(schema: Schema) {
  if (schema.project && schema.all) {
    throw SCHEMA_OPTIONS_ARE_MUTUALLY_EXCLUSIVE;
  }

  if (!schema.project && !schema.all) {
    schema.project = (
      await prompt<{ project: string }>([
        {
          message: 'What project should be converted?',
          type: 'input',
          name: 'project',
        },
      ])
    ).project;
  }
}

export async function convertToNxProjectGenerator(host: Tree, schema: Schema) {
  await validateSchema(schema);

  const projects = schema.all
    ? getProjects(host).entries()
    : ([[schema.project, readProjectConfiguration(host, schema.project)]] as [
        string,
        ProjectConfiguration & NxJsonProjectConfiguration
      ][]);

  for (const [project, configuration] of projects) {
    const configPath = getProjectConfigurationPath(configuration);
    if (host.exists(configPath)) {
      logger.warn(`Skipping ${project} since ${configPath} already exists.`);
      continue;
    }

    writeJson(host, configPath, configuration);

    updateJson(host, getWorkspacePath(host), (value) => {
      value.projects[project] = dirname(configPath);
      return value;
    });

    updateJson(host, 'nx.json', (value: NxJsonConfiguration) => {
      delete value.projects[project];
      return value;
    });
  }

  await formatFiles(host);
}

export default convertToNxProjectGenerator;

export const convertToNxProjectSchematic = convertNxGenerator(
  convertToNxProjectGenerator
);
