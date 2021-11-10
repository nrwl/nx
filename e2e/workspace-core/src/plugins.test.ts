import {
  newProject,
  removeProject,
  updateFile,
  readJson,
  runCLI,
} from '@nrwl/e2e/utils';

describe('Nx Plugins', () => {
  beforeAll(() => newProject());
  afterAll(() => removeProject({ onlyOnCI: true }));

  it('should use plugins defined in nx.json', () => {
    const nxJson = readJson('nx.json');
    nxJson.plugins = ['./tools/plugin'];
    updateFile('nx.json', JSON.stringify(nxJson));
    updateFile(
      'tools/plugin.js',
      `
      module.exports = {
        processProjectGraph: (graph) => {
          const Builder = require('@nrwl/devkit').ProjectGraphBuilder;
          const builder = new Builder(graph);
          builder.addNode({
            name: 'plugin-node',
            type: 'lib',
            data: {
              root: 'test'
            }
          });
          builder.addNode({
            name: 'plugin-node2',
            type: 'lib',
            data: {
              root: 'test2'
            }
          });
          builder.addImplicitDependency(
            'plugin-node',
            'plugin-node2'
          );
          return builder.getUpdatedProjectGraph();
        }
      };
    `
    );

    runCLI('dep-graph --file project-graph.json');
    const projectGraphJson = readJson('project-graph.json');
    expect(projectGraphJson.graph.nodes['plugin-node']).toBeDefined();
    expect(projectGraphJson.graph.nodes['plugin-node2']).toBeDefined();
    expect(projectGraphJson.graph.dependencies['plugin-node']).toContainEqual({
      type: 'implicit',
      source: 'plugin-node',
      target: 'plugin-node2',
    });
  });
});
