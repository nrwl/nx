import {
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { Schema } from '../schema';
import { checkDependencies } from './check-dependencies';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { libraryGenerator } from '../../library/library';
import { DependencyType, ProjectGraph } from '../../../core/project-graph';
let projectGraph: ProjectGraph;
jest.mock('../../../core/project-graph', () => ({
  ...jest.requireActual<any>('../../../core/project-graph'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => projectGraph),
}));

describe('checkDependencies', () => {
  let tree: Tree;
  let schema: Schema;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    schema = {
      projectName: 'my-source',
      skipFormat: false,
      forceRemove: false,
    };

    await libraryGenerator(tree, {
      name: 'my-dependent',
      standaloneConfig: false,
    });
    await libraryGenerator(tree, {
      name: 'my-source',
      standaloneConfig: false,
    });

    projectGraph = {
      nodes: {
        'my-source': {
          name: 'my-source',
          type: 'lib',
          data: {
            files: [],
            root: 'libs/my-source',
          },
        },
        'my-dependent': {
          name: 'my-dependent',
          type: 'lib',
          data: {
            files: [],
            root: 'libs/my-dependent',
          },
        },
      },
      externalNodes: {},
      dependencies: {
        'my-source': [
          {
            type: DependencyType.static,
            source: 'my-dependent',
            target: 'my-source',
          },
        ],
      },
    };
  });

  describe('static dependencies', () => {
    beforeEach(() => {
      const sourceFilePath = 'libs/my-source/src/lib/my-source.ts';
      tree.write(
        sourceFilePath,
        `export class MyClass {}
        `
      );

      const dependentFilePath = 'libs/my-dependent/src/lib/my-dependent.ts';
      tree.write(
        dependentFilePath,
        `import { MyClass } from '@proj/my-source';

        export MyExtendedClass extends MyClass {};
      `
      );
    });

    it('should fatally error if any dependent exists', async () => {
      await expect(checkDependencies(tree, schema)).rejects.toThrow();
    });

    it('should not error if forceRemove is true', async () => {
      schema.forceRemove = true;
      await expect(checkDependencies(tree, schema)).resolves.not.toThrow();
    });
  });

  describe('implicit dependencies', () => {
    beforeEach(async () => {
      const config = readProjectConfiguration(tree, 'my-dependent');
      updateProjectConfiguration(tree, 'my-dependent', {
        ...config,
        implicitDependencies: ['my-source'],
      });
    });

    it('should fatally error if any dependent exists', async () => {
      await expect(checkDependencies(tree, schema)).rejects.toThrow(
        `${schema.projectName} is still depended on by the following projects:\nmy-dependent`
      );
    });

    it('should not error if forceRemove is true', async () => {
      schema.forceRemove = true;
      await expect(checkDependencies(tree, schema)).resolves.not.toThrow();
    });
  });

  it('should not error if there are no dependents', async () => {
    projectGraph = {
      nodes: projectGraph.nodes,
      externalNodes: {},
      dependencies: {},
    };
    await expect(checkDependencies(tree, schema)).resolves.not.toThrow();
  });
});
