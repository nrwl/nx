import {
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  uniq,
  updateJson,
} from '@nrwl/e2e/utils';

describe('project graph creation', () => {
  beforeEach(() => newProject());

  afterEach(() => cleanupProject());

  it('should correctly build the nxdeps.json containing files for the project', () => {
    const libName = uniq('mylib');
    runCLI(`generate @nrwl/workspace:lib ${libName}`);

    runCLI(`graph --file=graph.json`);
    const { graph: graphJson } = readJson('graph.json');

    expect(graphJson.nodes[libName].data.files.length).toBeGreaterThan(0);
  });

  it("should correctly build the nxdeps.json containing files for the project when root is ''", () => {
    const libName = uniq('mylib');

    runCLI(`generate @nrwl/workspace:lib ${libName}`);
    updateJson(`libs/${libName}/project.json`, (json) => ({
      ...json,
      root: '',
    }));

    runCLI(`graph --file=graph.json`);

    const { graph: graphJson } = readJson('graph.json');
    expect(graphJson.nodes[libName].data.files.length).toBeGreaterThan(0);
  });

  it("should correctly build the graph.json containing files for the project when root is '' and for project that do not have root as ''", () => {
    const libName = uniq('mylib');
    const secondLibName = uniq('mysecondlib');

    runCLI(`generate @nrwl/workspace:lib ${libName}`);
    runCLI(`generate @nrwl/workspace:lib ${secondLibName}`);
    updateJson(`libs/${libName}/project.json`, (json) => ({
      ...json,
      root: '',
    }));

    runCLI(`graph --file=graph.json`);

    const { graph: graphJson } = readJson('graph.json');
    expect(graphJson.nodes[libName].data.files.length).toBeGreaterThan(0);
    expect(graphJson.nodes[secondLibName].data.files.length).toBeGreaterThan(0);
  });
});
