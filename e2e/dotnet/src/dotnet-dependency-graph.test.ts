import {
  checkFilesExist,
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  runCommand,
  tmpProjPath,
} from '@nx/e2e-utils';

import {
  addProjectReference,
  createDotNetProject,
  enableMultiTargeting,
} from './utils/create-dotnet-project';

interface GraphDependency {
  source: string;
  target: string;
  type: string;
}

describe('.NET Plugin - Dependency Graph', () => {
  beforeAll(() => {
    console.log('Creating new Nx workspace');
    newProject({ packages: [] });
    runCLI(`add @nx/dotnet`, { verbose: true });
    console.log('Nx workspace created');
  });

  afterAll(() => {
    cleanupProject();
    console.log('Nx workspace cleaned up');
  });

  describe('Multi-targeting projects', () => {
    beforeAll(() => {
      // Create a chain: MultiTargetLib -> SingleTargetLib -> BaseLib
      createDotNetProject({ name: 'BaseLib', type: 'classlib' });
      createDotNetProject({ name: 'SingleTargetLib', type: 'classlib' });
      createDotNetProject({ name: 'MultiTargetLib', type: 'classlib' });
      createDotNetProject({ name: 'ConsumerApp', type: 'console' });

      // Set up the dependency chain
      addProjectReference('SingleTargetLib', 'BaseLib');
      addProjectReference('MultiTargetLib', 'SingleTargetLib');
      addProjectReference('ConsumerApp', 'MultiTargetLib');

      // Enable multi-targeting on all libs in the chain and restore each to update assets
      enableMultiTargeting('BaseLib', ['net8.0', 'net9.0']);
      runCommand('dotnet restore BaseLib', { cwd: tmpProjPath() });

      enableMultiTargeting('SingleTargetLib', ['net8.0', 'net9.0']);
      runCommand('dotnet restore SingleTargetLib', { cwd: tmpProjPath() });

      enableMultiTargeting('MultiTargetLib', ['net8.0', 'net9.0']);
      runCommand('dotnet restore MultiTargetLib', { cwd: tmpProjPath() });
    });

    it('should detect dependencies for multi-targeting projects', () => {
      runCLI('graph --file=multi-target-graph.json');

      checkFilesExist('multi-target-graph.json');
      const { graph } = readJson('multi-target-graph.json');

      // MultiTargetLib should have SingleTargetLib as a dependency
      const multiTargetDeps: GraphDependency[] =
        graph.dependencies['MultiTargetLib'] || [];
      expect(
        multiTargetDeps.some((dep) => dep.target === 'SingleTargetLib')
      ).toBe(true);

      // SingleTargetLib should have BaseLib as a dependency
      const singleTargetDeps: GraphDependency[] =
        graph.dependencies['SingleTargetLib'] || [];
      expect(singleTargetDeps.some((dep) => dep.target === 'BaseLib')).toBe(
        true
      );

      // ConsumerApp should have MultiTargetLib as a dependency
      const consumerDeps: GraphDependency[] =
        graph.dependencies['ConsumerApp'] || [];
      expect(consumerDeps.some((dep) => dep.target === 'MultiTargetLib')).toBe(
        true
      );
    });

    it('should build multi-targeting projects with dependencies', () => {
      const output = runCLI('build ConsumerApp --verbose', { verbose: true });
      expect(output).toContain('Build succeeded');
    });
  });

  describe('Transitive dependencies', () => {
    beforeAll(() => {
      // Create a chain: AppProject -> MiddleLib -> LeafLib
      // We want to verify AppProject only shows MiddleLib as direct dep,
      // not LeafLib (which is a transitive dependency)
      createDotNetProject({ name: 'LeafLib', type: 'classlib' });
      createDotNetProject({ name: 'MiddleLib', type: 'classlib' });
      createDotNetProject({ name: 'AppProject', type: 'console' });

      // Set up the dependency chain
      addProjectReference('MiddleLib', 'LeafLib');
      addProjectReference('AppProject', 'MiddleLib');
    });

    it('should only show direct dependencies, not transitive ones', () => {
      runCLI('graph --file=transitive-graph.json');

      checkFilesExist('transitive-graph.json');
      const { graph } = readJson('transitive-graph.json');

      // AppProject should ONLY have MiddleLib as dependency
      const appDeps: GraphDependency[] = graph.dependencies['AppProject'] || [];
      const appProjectRefs = appDeps.filter(
        (dep) => dep.type === 'static' || dep.type === 'implicit'
      );

      // Should have MiddleLib
      expect(appProjectRefs.some((dep) => dep.target === 'MiddleLib')).toBe(
        true
      );

      // Should NOT have LeafLib (that's a transitive dependency)
      expect(appProjectRefs.some((dep) => dep.target === 'LeafLib')).toBe(
        false
      );

      // MiddleLib should have LeafLib as dependency
      const middleDeps: GraphDependency[] =
        graph.dependencies['MiddleLib'] || [];
      expect(middleDeps.some((dep) => dep.target === 'LeafLib')).toBe(true);
    });

    it('should correctly show transitive deps for multi-targeting projects', () => {
      // Enable multi-targeting to test the combined scenario
      enableMultiTargeting('LeafLib', ['net8.0', 'net9.0']);
      runCommand('dotnet restore LeafLib', { cwd: tmpProjPath() });

      enableMultiTargeting('MiddleLib', ['net8.0', 'net9.0']);
      runCommand('dotnet restore MiddleLib', { cwd: tmpProjPath() });

      runCLI('graph --file=transitive-multi-graph.json');

      checkFilesExist('transitive-multi-graph.json');
      const { graph } = readJson('transitive-multi-graph.json');

      // AppProject should still ONLY have MiddleLib as direct dependency
      const appDeps: GraphDependency[] = graph.dependencies['AppProject'] || [];
      const appProjectRefs = appDeps.filter(
        (dep) => dep.type === 'static' || dep.type === 'implicit'
      );

      expect(appProjectRefs.some((dep) => dep.target === 'MiddleLib')).toBe(
        true
      );
      expect(appProjectRefs.some((dep) => dep.target === 'LeafLib')).toBe(
        false
      );
    });
  });
});
