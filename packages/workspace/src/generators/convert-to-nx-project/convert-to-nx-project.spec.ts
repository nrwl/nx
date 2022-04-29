import {
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import enquirer = require('enquirer');
import { libraryGenerator } from '../library/library';
import * as devkit from '@nrwl/devkit';

import convertToNxProject, {
  SCHEMA_OPTIONS_ARE_MUTUALLY_EXCLUSIVE,
} from './convert-to-nx-project';
import { getProjectConfigurationPath } from './utils/get-project-configuration-path';

jest.mock('fs-extra', () => ({
  ...jest.requireActual<any>('fs-extra'),
  readJsonSync: () => ({}),
}));

jest.mock('enquirer', () => ({
  prompt: () => ({
    project: 'lib',
  }),
}));

describe('convert-to-nx-project', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should throw if project && all are both specified', async () => {
    const tree = createTreeWithEmptyWorkspace(2);

    await libraryGenerator(tree, {
      name: 'lib',
      standaloneConfig: false,
    });

    const p = convertToNxProject(tree, { all: true, project: 'lib' });
    await expect(p).rejects.toMatch(SCHEMA_OPTIONS_ARE_MUTUALLY_EXCLUSIVE);
  });

  it('should prompt for a project if neither project nor all are specified', async () => {
    const spy = jest.spyOn(enquirer, 'prompt');

    const tree = createTreeWithEmptyWorkspace(2);

    await libraryGenerator(tree, {
      name: 'lib',
      standaloneConfig: false,
    });

    const p = await convertToNxProject(tree, {});
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should not prompt for a project if all is specified', async () => {
    const spy = jest.spyOn(enquirer, 'prompt');

    const tree = createTreeWithEmptyWorkspace(2);

    await libraryGenerator(tree, {
      name: 'lib',
      standaloneConfig: false,
    });

    const p = await convertToNxProject(tree, { all: true });
    expect(spy).toHaveBeenCalledTimes(0);
  });

  it('should extract single project configuration to project.json', async () => {
    const tree = createTreeWithEmptyWorkspace(2);

    await libraryGenerator(tree, {
      name: 'lib',
      standaloneConfig: false,
    });

    const config = readProjectConfiguration(tree, 'lib');

    await convertToNxProject(tree, { project: 'lib' });
    const newConfigFile = await readJson(
      tree,
      getProjectConfigurationPath(config)
    );

    expect(config).toEqual(newConfigFile);
  });

  it('should extract all project configurations to project.json', async () => {
    const tree = createTreeWithEmptyWorkspace(2);

    await libraryGenerator(tree, {
      name: 'lib',
      standaloneConfig: false,
    });

    await libraryGenerator(tree, {
      name: 'lib2',
      standaloneConfig: false,
    });

    const configs = ['lib', 'lib2'].map((x) =>
      readProjectConfiguration(tree, x)
    );

    await convertToNxProject(tree, { all: true });

    for (const config of configs) {
      const newConfigFile = await readJson(
        tree,
        getProjectConfigurationPath(config)
      );
      expect(config).toEqual(newConfigFile);
    }
  });

  it('should include tags in project.json', async () => {
    const tree = createTreeWithEmptyWorkspace(2);

    await libraryGenerator(tree, {
      name: 'lib',
      tags: 'scope:test',
      standaloneConfig: false,
    });

    const config = readProjectConfiguration(tree, 'lib');

    await convertToNxProject(tree, { all: true });

    const newConfigFile = await readJson<ProjectConfiguration>(
      tree,
      getProjectConfigurationPath(config)
    );
    expect(newConfigFile.tags).toEqual(['scope:test']);
  });

  it('should set workspace.json to point to the root directory', async () => {
    const tree = createTreeWithEmptyWorkspace(2);
    await libraryGenerator(tree, {
      name: 'lib',
      standaloneConfig: false,
    });

    const config = readProjectConfiguration(tree, 'lib');
    await convertToNxProject(tree, { project: 'lib' });
    const json = readJson(tree, 'workspace.json');
    expect(json.projects.lib).toEqual(config.root);
  });

  it('should error in v1 schema with workspace.json', async () => {
    const tree = createTreeWithEmptyWorkspace(1);
    await libraryGenerator(tree, {
      name: 'lib',
      standaloneConfig: false,
    });
    try {
      await convertToNxProject(tree, { project: 'lib' });
    } catch (ex) {
      expect(ex).toBeDefined();
    }
    expect.assertions(1);
  });

  it('should format files by default', async () => {
    jest.spyOn(devkit, 'formatFiles');

    const tree = createTreeWithEmptyWorkspace(2);

    await libraryGenerator(tree, {
      name: 'lib',
      standaloneConfig: false,
      skipFormat: true,
    });

    await convertToNxProject(tree, { project: 'lib' });

    expect(devkit.formatFiles).toHaveBeenCalledTimes(1);
  });

  it('should format files when passing skipFormat false', async () => {
    jest.spyOn(devkit, 'formatFiles');

    const tree = createTreeWithEmptyWorkspace(2);

    await libraryGenerator(tree, {
      name: 'lib',
      standaloneConfig: false,
      skipFormat: true,
    });

    await convertToNxProject(tree, { project: 'lib', skipFormat: false });

    expect(devkit.formatFiles).toHaveBeenCalledTimes(1);
  });

  it('should not format files when passing skipFormat true ', async () => {
    jest.spyOn(devkit, 'formatFiles');

    const tree = createTreeWithEmptyWorkspace(2);

    await libraryGenerator(tree, {
      name: 'lib',
      standaloneConfig: false,
      skipFormat: true,
    });

    convertToNxProject(tree, { project: 'lib', skipFormat: true });

    expect(devkit.formatFiles).toHaveBeenCalledTimes(0);
  });
});
