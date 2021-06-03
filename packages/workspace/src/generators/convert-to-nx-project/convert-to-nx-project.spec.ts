import { NxJsonProjectConfiguration, readJson, readProjectConfiguration } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { libraryGenerator } from '../library/library';

import convertToNxProject, {
  PROJECT_OR_ALL_IS_REQUIRED,
  SCHEMA_OPTIONS_ARE_MUTUALLY_EXCLUSIVE,
} from './convert-to-nx-project';
import { getProjectConfigurationPath } from './utils/get-project-configuration-path';

jest.mock('fs-extra', () => ({
  ...jest.requireActual('fs-extra'),
  readJsonSync: () => ({})
}));

describe('convert-to-nx-project', () => {
  it('should throw if project && all are both specified', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await libraryGenerator(tree, {
      name: 'lib',
    });

    const p = convertToNxProject(tree, { all: true, project: 'lib' });
    await expect(p).rejects.toMatch(SCHEMA_OPTIONS_ARE_MUTUALLY_EXCLUSIVE);
  });

  it('should throw if neither project nor all are specified', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await libraryGenerator(tree, {
      name: 'lib',
    });

    const p = convertToNxProject(tree, {});
    await expect(p).rejects.toMatch(PROJECT_OR_ALL_IS_REQUIRED);
  });

  it('should extract single project configuration to nx-project.json', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await libraryGenerator(tree, {
      name: 'lib',
    });

    const config = readProjectConfiguration(tree, 'lib');
 
    await convertToNxProject(tree, { project: 'lib' });
    const newConfigFile = await readJson(tree, getProjectConfigurationPath(config));

    expect(config).toEqual(newConfigFile);
  });
  
  it('should extract all project configurations to nx-project.json', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await libraryGenerator(tree, {
      name: 'lib',
    });
    
    await libraryGenerator(tree, {
      name: 'lib2',
    });

    const configs = ['lib', 'lib2'].map(x => readProjectConfiguration(tree, x))
    

    await convertToNxProject(tree, { all: true });
  
    for (const config of configs) {
      const newConfigFile = await readJson(tree, getProjectConfigurationPath(config));
      expect(config).toEqual(newConfigFile);
    }
  });

  it('should extract tags from nx.json into nx-project.json', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await libraryGenerator(tree, {
      name: 'lib',
      tags: 'scope:test'
    });
    
    const config =  readProjectConfiguration(tree, 'lib');
    
    await convertToNxProject(tree, { all: true });
  
    const newConfigFile = await readJson<NxJsonProjectConfiguration>(tree, getProjectConfigurationPath(config));
    expect(newConfigFile.tags).toEqual(['scope:test']);
  });

});
