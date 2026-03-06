import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import { ProjectNameInNodePropsManager } from './name-substitution-manager';

describe('ProjectNameInNodePropsManager', () => {
  // ============== Helper Functions ==============

  // Shared nameMap populated by identifyProjects, passed to the manager
  // via a lazy accessor — mirrors how ProjectNodesManager works in
  // production.
  let nameMap: Record<string, ProjectConfiguration>;

  beforeEach(() => {
    nameMap = {};
  });

  /**
   * Creates a manager wired to the shared nameMap.
   */
  function createManager(): ProjectNameInNodePropsManager {
    return new ProjectNameInNodePropsManager(() => nameMap);
  }

  /**
   * Helper to create a mock project configuration with common defaults.
   * Uses 'any' to allow flexible test data without strict typing.
   */
  function createProject(
    name: string,
    root: string,
    overrides: Record<string, any> = {}
  ): Record<string, any> {
    return {
      name,
      root,
      ...overrides,
    };
  }

  /**
   * Helper to create a mock root map (projects keyed by root)
   */
  function createRootMap(
    projects: Array<Record<string, any>>
  ): Record<string, ProjectConfiguration> {
    const map: Record<string, ProjectConfiguration> = {};
    for (const project of projects) {
      map[project.root] = { ...project } as ProjectConfiguration;
    }
    return map;
  }

  /**
   * Helper to create a plugin result (projects keyed by root)
   */
  function createPluginResult(
    projects: Array<Record<string, any>>
  ): Record<string, any> {
    const map: Record<string, any> = {};
    for (const project of projects) {
      map[project.root] = { ...project };
    }
    return map;
  }

  /**
   * Helper to simulate the merge phase: calls identifyProjectWithRoot for
   * every project in the plugin result and populates the shared nameMap —
   * matching the real ProjectNodesManager integration flow.
   */
  function identifyProjects(
    manager: ProjectNameInNodePropsManager,
    ...pluginResults: Array<Record<string, any>>
  ) {
    for (const result of pluginResults) {
      for (const root in result) {
        const project = result[root];
        if (project.name) {
          // Simulate what ProjectNodesManager does: track previous name,
          // update nameMap, notify manager on name change.
          const previousName = Object.keys(nameMap).find(
            (n) => nameMap[n]?.root === root
          );
          if (previousName && previousName !== project.name) {
            delete nameMap[previousName];
          }
          // Store in nameMap — in real code this is the same object as
          // rootMap[root], but for tests we create a minimal config.
          nameMap[project.name] = {
            root,
            name: project.name,
            targets: project.targets,
          } as ProjectConfiguration;
          // Notify manager when name changes — matching
          // ProjectNodesManager.mergeProjectNode behavior. This includes
          // first identification (previousName undefined) for forward-ref
          // promotion, and renames (previousName differs).
          if (project.name !== previousName) {
            manager.identifyProjectWithRoot(root, project.name);
          }
        }
      }
    }
  }

  /**
   * Helper to simulate a rename: updates the nameMap and notifies the
   * manager. Call this instead of manager.identifyProjectWithRoot directly
   * when simulating a later plugin renaming a project.
   */
  function renameProject(
    manager: ProjectNameInNodePropsManager,
    root: string,
    newName: string
  ) {
    // Find and remove old name
    const oldName = Object.keys(nameMap).find((n) => nameMap[n]?.root === root);
    const oldTargets = oldName ? nameMap[oldName]?.targets : undefined;
    if (oldName) {
      delete nameMap[oldName];
    }
    nameMap[newName] = {
      root,
      name: newName,
      targets: oldTargets,
    } as ProjectConfiguration;
    manager.identifyProjectWithRoot(root, newName);
  }

  /**
   * Helper to build a target with inputs that reference projects.
   * Note: The InputDefinition type requires both 'input' and 'projects' properties.
   */
  function createTargetWithProjectInput(
    projectsRef: string | string[]
  ): Record<string, any> {
    return {
      inputs: [{ input: 'default', projects: projectsRef }],
    };
  }

  /**
   * Helper to build a target with dependsOn that reference projects
   */
  function createTargetWithDependsOn(
    projectsRef: string | string[]
  ): Record<string, any> {
    return {
      dependsOn: [{ target: 'build', projects: projectsRef }],
    };
  }

  // ============== Basic Tests ==============

  describe('basic functionality', () => {
    it('should create an instance without errors', () => {
      const manager = createManager();
      expect(manager).toBeDefined();
    });

    it('should handle empty plugin results without errors', () => {
      const manager = createManager();
      manager.registerSubstitutorsForNodeResults({});
      manager.applySubstitutions({});
      // No error should be thrown
    });

    it('should handle undefined plugin results', () => {
      const manager = createManager();
      manager.registerSubstitutorsForNodeResults(undefined);
      // No error should be thrown
    });
  });

  // ============== Input Projects Reference Tests ==============

  describe('inputs with projects reference', () => {
    it('should substitute a single project name in inputs.projects (string)', () => {
      const manager = createManager();

      // Project A references project B by name in its inputs
      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('project-b'),
        },
      });

      const projectB = createProject('project-b', 'libs/b');

      const pluginResultProjects = createPluginResult([projectA, projectB]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);

      // Simulate project B's name being changed
      renameProject(manager, 'libs/b', 'project-b-renamed');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'project-b-renamed', root: 'libs/b' },
      ]);

      manager.applySubstitutions(rootMap);

      // The input reference should now point to the new name
      expect(projectA.targets.build.inputs[0].projects).toBe(
        'project-b-renamed'
      );
    });

    it('should substitute multiple project names in inputs.projects (array)', () => {
      const manager = createManager();

      // Project A references projects B and C by name in its inputs
      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput(['project-b', 'project-c']),
        },
      });

      const projectB = createProject('project-b', 'libs/b');
      const projectC = createProject('project-c', 'libs/c');

      const pluginResultProjects = createPluginResult([
        projectA,
        projectB,
        projectC,
      ]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);

      // Simulate both projects being renamed
      renameProject(manager, 'libs/b', 'new-b');
      renameProject(manager, 'libs/c', 'new-c');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'new-b', root: 'libs/b' },
        { name: 'new-c', root: 'libs/c' },
      ]);

      manager.applySubstitutions(rootMap);

      // Both references should be updated
      const inputProjects = projectA.targets.build.inputs[0]
        .projects as string[];
      expect(inputProjects[0]).toBe('new-b');
      expect(inputProjects[1]).toBe('new-c');
    });

    it('should not reintroduce removed entries when inputs.projects array shrinks', () => {
      const manager = createManager();

      const projectAInitial = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput(['project-b', 'project-c']),
        },
      });

      const initialResult = createPluginResult([projectAInitial]);
      identifyProjects(manager, initialResult);
      manager.registerSubstitutorsForNodeResults(initialResult);

      const projectAUpdated = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput(['project-b']),
        },
      });

      const updatedResult = createPluginResult([projectAUpdated]);
      identifyProjects(manager, updatedResult);
      manager.registerSubstitutorsForNodeResults(updatedResult);
      renameProject(manager, 'libs/c', 'renamed-c');

      const rootMap = createRootMap([
        {
          name: 'project-a',
          root: 'libs/a',
          targets: projectAUpdated.targets,
        },
        { name: 'renamed-c', root: 'libs/c' },
      ]);

      manager.applySubstitutions(rootMap);

      expect(projectAUpdated.targets.build.inputs[0].projects).toEqual([
        'project-b',
      ]);
    });

    it('should not substitute "self" in inputs.projects', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('self'),
        },
      });

      const pluginResultProjects = createPluginResult([projectA]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);

      // Even if we mark this dirty, 'self' should not be substituted
      renameProject(manager, 'libs/a', 'renamed-a');

      const rootMap = createRootMap([
        { name: 'renamed-a', root: 'libs/a', targets: projectA.targets },
      ]);

      manager.applySubstitutions(rootMap);

      // 'self' should remain unchanged
      expect(projectA.targets.build.inputs[0].projects).toBe('self');
    });

    it('should not substitute "dependencies" in inputs.projects', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('dependencies'),
        },
      });

      const pluginResultProjects = createPluginResult([projectA]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      renameProject(manager, 'libs/a', 'renamed-a');

      const rootMap = createRootMap([
        { name: 'renamed-a', root: 'libs/a', targets: projectA.targets },
      ]);

      manager.applySubstitutions(rootMap);

      // 'dependencies' should remain unchanged
      expect(projectA.targets.build.inputs[0].projects).toBe('dependencies');
    });
  });

  // ============== DependsOn Projects Reference Tests ==============

  describe('dependsOn with projects reference', () => {
    it('should substitute a single project name in dependsOn.projects (string)', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithDependsOn('project-b'),
        },
      });

      const projectB = createProject('project-b', 'libs/b');

      const pluginResultProjects = createPluginResult([projectA, projectB]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      renameProject(manager, 'libs/b', 'project-b-renamed');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'project-b-renamed', root: 'libs/b' },
      ]);

      manager.applySubstitutions(rootMap);

      expect(projectA.targets.build.dependsOn[0].projects).toBe(
        'project-b-renamed'
      );
    });

    it('should substitute multiple project names in dependsOn.projects (array)', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithDependsOn(['project-b', 'project-c']),
        },
      });

      const projectB = createProject('project-b', 'libs/b');
      const projectC = createProject('project-c', 'libs/c');

      const pluginResultProjects = createPluginResult([
        projectA,
        projectB,
        projectC,
      ]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      renameProject(manager, 'libs/b', 'new-b');
      renameProject(manager, 'libs/c', 'new-c');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'new-b', root: 'libs/b' },
        { name: 'new-c', root: 'libs/c' },
      ]);

      manager.applySubstitutions(rootMap);

      const dependsOnProjects = projectA.targets.build.dependsOn[0]
        .projects as string[];
      expect(dependsOnProjects[0]).toBe('new-b');
      expect(dependsOnProjects[1]).toBe('new-c');
    });

    it('should not substitute "*" in dependsOn.projects', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithDependsOn('*'),
        },
      });

      const pluginResultProjects = createPluginResult([projectA]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      renameProject(manager, 'libs/a', 'renamed-a');

      const rootMap = createRootMap([
        { name: 'renamed-a', root: 'libs/a', targets: projectA.targets },
      ]);

      manager.applySubstitutions(rootMap);

      expect(projectA.targets.build.dependsOn[0].projects).toBe('*');
    });

    it('should not substitute "self" in dependsOn.projects', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithDependsOn('self'),
        },
      });

      const pluginResultProjects = createPluginResult([projectA]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      renameProject(manager, 'libs/a', 'renamed-a');

      const rootMap = createRootMap([
        { name: 'renamed-a', root: 'libs/a', targets: projectA.targets },
      ]);

      manager.applySubstitutions(rootMap);

      expect(projectA.targets.build.dependsOn[0].projects).toBe('self');
    });

    it('should not substitute "dependencies" in dependsOn.projects', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithDependsOn('dependencies'),
        },
      });

      const pluginResultProjects = createPluginResult([projectA]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      renameProject(manager, 'libs/a', 'renamed-a');

      const rootMap = createRootMap([
        { name: 'renamed-a', root: 'libs/a', targets: projectA.targets },
      ]);

      manager.applySubstitutions(rootMap);

      expect(projectA.targets.build.dependsOn[0].projects).toBe('dependencies');
    });

    it('should not substitute glob patterns in dependsOn.projects array', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithDependsOn(['lib-*', 'project-b']),
        },
      });

      const projectB = createProject('project-b', 'libs/b');

      const pluginResultProjects = createPluginResult([projectA, projectB]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      renameProject(manager, 'libs/b', 'new-b');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'new-b', root: 'libs/b' },
      ]);

      manager.applySubstitutions(rootMap);

      const dependsOnProjects = projectA.targets.build.dependsOn[0]
        .projects as string[];
      // Glob pattern should remain unchanged
      expect(dependsOnProjects[0]).toBe('lib-*');
      // Exact project name should be substituted
      expect(dependsOnProjects[1]).toBe('new-b');
    });

    it('should not reintroduce removed entries when dependsOn.projects array shrinks', () => {
      const manager = createManager();

      const projectAInitial = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithDependsOn(['project-b', 'project-c']),
        },
      });

      const initialResult = createPluginResult([projectAInitial]);
      identifyProjects(manager, initialResult);
      manager.registerSubstitutorsForNodeResults(initialResult);

      const projectAUpdated = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithDependsOn(['project-b']),
        },
      });

      const updatedResult = createPluginResult([projectAUpdated]);
      identifyProjects(manager, updatedResult);
      manager.registerSubstitutorsForNodeResults(updatedResult);
      renameProject(manager, 'libs/c', 'renamed-c');

      const rootMap = createRootMap([
        {
          name: 'project-a',
          root: 'libs/a',
          targets: projectAUpdated.targets,
        },
        { name: 'renamed-c', root: 'libs/c' },
      ]);

      manager.applySubstitutions(rootMap);

      expect(projectAUpdated.targets.build.dependsOn[0].projects).toEqual([
        'project-b',
      ]);
    });

    it('should substitute references for targets expanded from glob keys', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          'build-*': createTargetWithDependsOn('project-b'),
        },
      });
      const projectB = createProject('project-b', 'libs/b');

      const globResult = createPluginResult([projectA, projectB]);
      identifyProjects(manager, globResult);
      manager.registerSubstitutorsForNodeResults(globResult);
      renameProject(manager, 'libs/b', 'renamed-b');

      const expandedTargets = {
        'build-prod': createTargetWithDependsOn('project-b'),
      };
      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: expandedTargets },
        { name: 'renamed-b', root: 'libs/b' },
      ]);

      manager.applySubstitutions(rootMap);

      expect(expandedTargets['build-prod'].dependsOn[0].projects).toBe(
        'renamed-b'
      );
    });
  });

  // ============== DependsOn String-Form Target String Tests ==============

  describe('dependsOn with string-form target strings', () => {
    it('should substitute a project name in a "project:target" string entry', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: {
            dependsOn: ['project-b:compile'],
          },
        },
      });

      const projectB = createProject('project-b', 'libs/b');

      const pluginResultProjects = createPluginResult([projectA, projectB]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      renameProject(manager, 'libs/b', 'project-b-renamed');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'project-b-renamed', root: 'libs/b' },
      ]);

      manager.applySubstitutions(rootMap);

      expect(projectA.targets.build.dependsOn[0]).toBe(
        'project-b-renamed:compile'
      );
    });

    it('should not substitute "^target" dependency-mode strings', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: {
            dependsOn: ['^build'],
          },
        },
      });

      const pluginResultProjects = createPluginResult([projectA]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      renameProject(manager, 'libs/a', 'renamed-a');

      const rootMap = createRootMap([
        { name: 'renamed-a', root: 'libs/a', targets: projectA.targets },
      ]);

      manager.applySubstitutions(rootMap);

      expect(projectA.targets.build.dependsOn[0]).toBe('^build');
    });

    it('should not substitute bare target name strings (no colon)', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: {
            dependsOn: ['compile'],
          },
        },
      });

      const pluginResultProjects = createPluginResult([projectA]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      renameProject(manager, 'libs/a', 'renamed-a');

      const rootMap = createRootMap([
        { name: 'renamed-a', root: 'libs/a', targets: projectA.targets },
      ]);

      manager.applySubstitutions(rootMap);

      expect(projectA.targets.build.dependsOn[0]).toBe('compile');
    });

    it('should handle mixed string and object dependsOn entries', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: {
            dependsOn: [
              'project-b:compile',
              { target: 'build', projects: 'project-c' },
              '^lint',
            ],
          },
        },
      });

      const projectB = createProject('project-b', 'libs/b');
      const projectC = createProject('project-c', 'libs/c');

      const pluginResultProjects = createPluginResult([
        projectA,
        projectB,
        projectC,
      ]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      renameProject(manager, 'libs/b', 'new-b');
      renameProject(manager, 'libs/c', 'new-c');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'new-b', root: 'libs/b' },
        { name: 'new-c', root: 'libs/c' },
      ]);

      manager.applySubstitutions(rootMap);

      expect(projectA.targets.build.dependsOn[0]).toBe('new-b:compile');
      expect(projectA.targets.build.dependsOn[1].projects).toBe('new-c');
      expect(projectA.targets.build.dependsOn[2]).toBe('^lint');
    });

    it('should handle "project:target" string from a separate plugin result', () => {
      const manager = createManager();

      const projA = createProject('project-a', 'proj-a', {
        targets: {
          build: {
            dependsOn: ['project-b-original:compile'],
          },
        },
      });
      const projAResult = createPluginResult([projA]);

      const projB = createProject('project-b-original', 'proj-b');
      const projBResult = createPluginResult([projB]);

      identifyProjects(manager, projAResult);
      manager.registerSubstitutorsForNodeResults(projAResult);
      identifyProjects(manager, projBResult);
      manager.registerSubstitutorsForNodeResults(projBResult);
      renameProject(manager, 'proj-b', 'project-b-renamed');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'proj-a', targets: projA.targets },
        { name: 'project-b-renamed', root: 'proj-b' },
      ]);

      manager.applySubstitutions(rootMap);

      expect(projA.targets.build.dependsOn[0]).toBe(
        'project-b-renamed:compile'
      );
    });

    it('should handle quoted project names with colons', () => {
      const manager = createManager();

      // Register the colon-bearing project so splitTargetFromNodes
      // can recognise it in the string-form dependsOn entry.
      const scopedPkg = createProject('@scope:pkg', 'libs/scoped', {
        targets: { build: {} },
      });

      // dependsOn uses quoted syntax: "@scope:pkg" contains a colon
      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: {
            dependsOn: ['"@scope:pkg":build'],
          },
        },
      });

      const quotedResult = createPluginResult([scopedPkg, projectA]);
      identifyProjects(manager, quotedResult);
      manager.registerSubstitutorsForNodeResults(quotedResult);
      renameProject(manager, 'libs/scoped', 'new-pkg');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'new-pkg', root: 'libs/scoped' },
      ]);

      manager.applySubstitutions(rootMap);

      // The colon-bearing name is resolved via splitByColons quoting,
      // so the substitutor is keyed by '@scope:pkg'.
      expect(projectA.targets.build.dependsOn[0]).toBe('new-pkg:build');
    });

    it('should handle project names with colons when the final name also has colons', () => {
      const manager = createManager();

      const projectB = createProject('project-b', 'libs/b', {
        targets: { compile: {} },
      });

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: {
            dependsOn: ['project-b:compile'],
          },
        },
      });

      const colonResult = createPluginResult([projectA, projectB]);
      identifyProjects(manager, colonResult);
      manager.registerSubstitutorsForNodeResults(colonResult);
      renameProject(manager, 'libs/b', '@scope:new-b');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        // The renamed project has a colon in its name
        { name: '@scope:new-b', root: 'libs/b' },
      ]);

      manager.applySubstitutions(rootMap);

      // No quoting — downstream splitTarget with the full graph will
      // correctly match the project name against known projects.
      expect(projectA.targets.build.dependsOn[0]).toBe('@scope:new-b:compile');
    });

    it('should disambiguate colon strings using known project nodes', () => {
      const manager = createManager();

      // Register a project whose name contains colons so
      // splitTargetFromNodes can match it against "a:b:c".
      const projectAB = createProject('a:b', 'libs/ab', {
        targets: { c: {} },
      });

      const projectOwner = createProject('project-a', 'libs/a', {
        targets: {
          build: {
            dependsOn: ['a:b:c'],
          },
        },
      });

      const result = createPluginResult([projectAB, projectOwner]);
      identifyProjects(manager, result);
      manager.registerSubstitutorsForNodeResults(result);
      renameProject(manager, 'libs/ab', 'new-ab');

      const rootMap = createRootMap([
        {
          name: 'project-a',
          root: 'libs/a',
          targets: projectOwner.targets,
        },
        { name: 'new-ab', root: 'libs/ab' },
      ]);

      manager.applySubstitutions(rootMap);

      // splitTargetFromNodes matched "a:b" as the project (with target "c")
      // rather than "a" as the project (with target "b:c").
      expect(projectOwner.targets.build.dependsOn[0]).toBe('new-ab:c');
    });

    it('should substitute a colon-leading project name in a "project:target" string entry', () => {
      const manager = createManager();

      // Project whose name starts with ':' — no targets of its own,
      // so findMatchingSegments cannot resolve the string-form entry.
      const colonPkg = createProject(':pkg', 'libs/pkg');

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: {
            dependsOn: [':pkg:compile'],
          },
        },
      });

      const colonLeadingResult = createPluginResult([colonPkg, projectA]);
      identifyProjects(manager, colonLeadingResult);
      manager.registerSubstitutorsForNodeResults(colonLeadingResult);
      renameProject(manager, 'libs/pkg', 'renamed-pkg');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'renamed-pkg', root: 'libs/pkg' },
      ]);

      manager.applySubstitutions(rootMap);

      expect(projectA.targets.build.dependsOn[0]).toBe('renamed-pkg:compile');
    });

    it('should substitute for targets expanded from glob keys with string dependsOn', () => {
      const manager = createManager();

      const projectB = createProject('project-b', 'libs/b', {
        targets: { compile: {} },
      });

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          'build-*': {
            dependsOn: ['project-b:compile'],
          },
        },
      });

      const globStringResult = createPluginResult([projectB, projectA]);
      identifyProjects(manager, globStringResult);
      manager.registerSubstitutorsForNodeResults(globStringResult);
      renameProject(manager, 'libs/b', 'renamed-b');

      const expandedTargets = {
        'build-prod': {
          dependsOn: ['project-b:compile'],
        },
      };
      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: expandedTargets },
        { name: 'renamed-b', root: 'libs/b' },
      ]);

      manager.applySubstitutions(rootMap);

      expect(expandedTargets['build-prod'].dependsOn[0]).toBe(
        'renamed-b:compile'
      );
    });
  });

  // ============== Multiple Plugin Calls Tests ==============

  describe('multiple plugin calls', () => {
    it('should resolve dependsOn when owner and referenced project come from separate result entries and the referenced project is later renamed', () => {
      // This reproduces the e2e failure:
      // - Plugin returns two separate entries: one for proj-a (with dependsOn
      //   referencing 'project-b-original') and one for proj-b (name:
      //   'project-b-original').
      // - After all merges, proj-b's name changes to 'project-b-renamed'.
      // - With a naive two-pass approach, projectRootMap already has
      //   'project-b-renamed' when substitutors are registered, so
      //   nameMap.get('project-b-original') returns undefined and no
      //   substitutor is ever registered.
      const manager = createManager();

      const projA = createProject('project-a-original', 'proj-a', {
        targets: {
          build: createTargetWithDependsOn('project-b-original'),
        },
      });
      const projAResult = createPluginResult([projA]);

      const projB = createProject('project-b-original', 'proj-b');
      const projBResult = createPluginResult([projB]);

      // Simulate two-pass: projectRootMap is fully merged BEFORE substitutors
      // are registered. proj-b was already renamed, so the map only has
      // 'project-b-renamed', not 'project-b-original'.
      const projectRootMap = createRootMap([
        { name: 'project-a-original', root: 'proj-a', targets: projA.targets },
        { name: 'project-b-renamed', root: 'proj-b' },
      ]);

      identifyProjects(manager, projAResult);
      manager.registerSubstitutorsForNodeResults(projAResult);
      identifyProjects(manager, projBResult);
      manager.registerSubstitutorsForNodeResults(projBResult);
      renameProject(manager, 'proj-b', 'project-b-renamed');
      manager.applySubstitutions(projectRootMap);

      expect(projA.targets.build.dependsOn[0].projects).toBe(
        'project-b-renamed'
      );
    });

    it('should handle registering substitutors from multiple plugin calls', () => {
      const manager = createManager();

      // First plugin creates projects A and B, where A references B
      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('project-b'),
        },
      });
      const projectB = createProject('project-b', 'libs/b');

      const firstPluginResult = createPluginResult([projectA, projectB]);

      identifyProjects(manager, firstPluginResult);
      manager.registerSubstitutorsForNodeResults(firstPluginResult);

      // Second plugin creates projects C and D, where C references D
      const projectC = createProject('project-c', 'libs/c', {
        targets: {
          test: createTargetWithProjectInput('project-d'),
        },
      });
      const projectD = createProject('project-d', 'libs/d');

      const secondPluginResult = createPluginResult([projectC, projectD]);

      identifyProjects(manager, secondPluginResult);
      manager.registerSubstitutorsForNodeResults(secondPluginResult);

      // Mark both B and D as dirty
      renameProject(manager, 'libs/b', 'renamed-b');
      renameProject(manager, 'libs/d', 'renamed-d');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'renamed-b', root: 'libs/b' },
        { name: 'project-c', root: 'libs/c', targets: projectC.targets },
        { name: 'renamed-d', root: 'libs/d' },
      ]);

      manager.applySubstitutions(rootMap);

      // Both references should be updated
      expect(projectA.targets.build.inputs[0].projects).toBe('renamed-b');
      expect(projectC.targets.test.inputs[0].projects).toBe('renamed-d');
    });

    it('should handle cross-plugin references through merged configurations', () => {
      const manager = createManager();

      // First plugin creates project B
      const projectB = createProject('project-b', 'libs/b');
      const firstPluginResult = createPluginResult([projectB]);
      identifyProjects(manager, firstPluginResult);
      manager.registerSubstitutorsForNodeResults(firstPluginResult);

      // Second plugin creates project A that references B (which is in merged configs)
      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('project-b'),
        },
      });
      const secondPluginResult = createPluginResult([projectA]);

      identifyProjects(manager, secondPluginResult);
      manager.registerSubstitutorsForNodeResults(secondPluginResult);

      // Mark B as dirty
      renameProject(manager, 'libs/b', 'renamed-b');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'renamed-b', root: 'libs/b' },
      ]);

      manager.applySubstitutions(rootMap);

      expect(projectA.targets.build.inputs[0].projects).toBe('renamed-b');
    });

    it('should handle sequential registrations with overlapping projects', () => {
      const manager = createManager();

      // Both plugins reference the same project
      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('shared-lib'),
        },
      });

      const projectB = createProject('project-b', 'libs/b', {
        targets: {
          test: createTargetWithDependsOn('shared-lib'),
        },
      });

      const sharedLib = createProject('shared-lib', 'libs/shared');

      // First call
      const firstResult = createPluginResult([projectA, sharedLib]);
      identifyProjects(manager, firstResult);
      manager.registerSubstitutorsForNodeResults(firstResult);

      // Second call
      const secondResult = createPluginResult([projectB]);
      identifyProjects(manager, secondResult);
      manager.registerSubstitutorsForNodeResults(secondResult);

      // Rename shared-lib
      renameProject(manager, 'libs/shared', 'renamed-shared');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'project-b', root: 'libs/b', targets: projectB.targets },
        { name: 'renamed-shared', root: 'libs/shared' },
      ]);

      manager.applySubstitutions(rootMap);

      // Both references should be updated
      expect(projectA.targets.build.inputs[0].projects).toBe('renamed-shared');
      expect(projectB.targets.test.dependsOn[0].projects).toBe(
        'renamed-shared'
      );
    });
  });

  // ============== Complex Scenarios ==============

  describe('complex scenarios', () => {
    it('should handle multiple targets with various reference types', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: {
            inputs: [
              { input: 'default', projects: 'project-b' },
              { input: 'default', projects: ['project-c', 'project-d'] },
            ],
            dependsOn: [
              { target: 'build', projects: 'project-b' },
              { target: 'compile', projects: ['project-c', 'project-d'] },
            ],
          },
          test: createTargetWithProjectInput('project-b'),
          lint: createTargetWithDependsOn('project-c'),
        },
      });

      const projectB = createProject('project-b', 'libs/b');
      const projectC = createProject('project-c', 'libs/c');
      const projectD = createProject('project-d', 'libs/d');

      const pluginResultProjects = createPluginResult([
        projectA,
        projectB,
        projectC,
        projectD,
      ]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);

      // Rename all referenced projects
      renameProject(manager, 'libs/b', 'new-b');
      renameProject(manager, 'libs/c', 'new-c');
      renameProject(manager, 'libs/d', 'new-d');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'new-b', root: 'libs/b' },
        { name: 'new-c', root: 'libs/c' },
        { name: 'new-d', root: 'libs/d' },
      ]);

      manager.applySubstitutions(rootMap);

      // Verify all substitutions
      expect(projectA.targets.build.inputs[0].projects).toBe('new-b');
      expect((projectA.targets.build.inputs[1].projects as string[])[0]).toBe(
        'new-c'
      );
      expect((projectA.targets.build.inputs[1].projects as string[])[1]).toBe(
        'new-d'
      );
      expect(projectA.targets.build.dependsOn[0].projects).toBe('new-b');
      expect(
        (projectA.targets.build.dependsOn[1].projects as string[])[0]
      ).toBe('new-c');
      expect(
        (projectA.targets.build.dependsOn[1].projects as string[])[1]
      ).toBe('new-d');
      expect(projectA.targets.test.inputs[0].projects).toBe('new-b');
      expect(projectA.targets.lint.dependsOn[0].projects).toBe('new-c');
    });

    it('should handle a project being renamed multiple times in sequence', () => {
      const manager = createManager();

      // Plugin 1: creates project-b-original and project-a referencing it
      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('project-b-original'),
        },
      });
      const projectB = createProject('project-b-original', 'libs/b');
      const renameResult1 = createPluginResult([projectA, projectB]);
      identifyProjects(manager, renameResult1);
      manager.registerSubstitutorsForNodeResults(renameResult1);

      // Plugin 2: renames project-b to intermediate and project-c references it
      const projectBIntermediate = createProject(
        'project-b-intermediate',
        'libs/b'
      );
      const projectC = createProject('project-c', 'libs/c', {
        targets: {
          build: createTargetWithProjectInput('project-b-intermediate'),
        },
      });
      const renameResult2 = createPluginResult([
        projectBIntermediate,
        projectC,
      ]);
      identifyProjects(manager, renameResult2);
      manager.registerSubstitutorsForNodeResults(renameResult2);

      // project-b-original -> project-b-intermediate -> project-b-final
      renameProject(manager, 'libs/b', 'project-b-intermediate');
      renameProject(manager, 'libs/b', 'project-b-final');
      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'project-c', root: 'libs/c', targets: projectC.targets },
        { name: 'project-b-final', root: 'libs/b' },
      ]);
      manager.applySubstitutions(rootMap);

      expect(projectA.targets.build.inputs[0].projects).toBe('project-b-final');
      expect(projectC.targets.build.inputs[0].projects).toBe('project-b-final');
    });

    it('should handle circular references (A -> B -> A)', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('project-b'),
        },
      });

      const projectB = createProject('project-b', 'libs/b', {
        targets: {
          build: createTargetWithProjectInput('project-a'),
        },
      });

      const pluginResultProjects = createPluginResult([projectA, projectB]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);

      // Rename both projects
      renameProject(manager, 'libs/a', 'renamed-a');
      renameProject(manager, 'libs/b', 'renamed-b');

      const rootMap = createRootMap([
        { name: 'renamed-a', root: 'libs/a', targets: projectA.targets },
        { name: 'renamed-b', root: 'libs/b', targets: projectB.targets },
      ]);

      manager.applySubstitutions(rootMap);

      // Both references should be updated
      expect(projectA.targets.build.inputs[0].projects).toBe('renamed-b');
      expect(projectB.targets.build.inputs[0].projects).toBe('renamed-a');
    });

    it('should handle large number of projects and references', () => {
      const manager = createManager();
      const projectCount = 50;
      const projects: any[] = [];
      const rootMap = createRootMap([]);

      // Create many projects where each references the next
      for (let i = 0; i < projectCount; i++) {
        const nextIndex = (i + 1) % projectCount;
        projects.push(
          createProject(`project-${i}`, `libs/project-${i}`, {
            targets: {
              build: createTargetWithProjectInput(`project-${nextIndex}`),
            },
          })
        );
      }

      const pluginResultProjects = createPluginResult(projects);
      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);

      // Mark all as dirty
      for (let i = 0; i < projectCount; i++) {
        renameProject(manager, `libs/project-${i}`, `renamed-${i}`);
        rootMap[`libs/project-${i}`] = {
          name: `renamed-${i}`,
          root: `libs/project-${i}`,
          targets: projects[i].targets,
        };
      }

      manager.applySubstitutions(rootMap);

      // Verify all substitutions
      for (let i = 0; i < projectCount; i++) {
        const nextIndex = (i + 1) % projectCount;
        expect(projects[i].targets.build.inputs[0].projects).toBe(
          `renamed-${nextIndex}`
        );
      }
    });

    it('should only substitute dirty roots', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('project-b'),
          test: createTargetWithProjectInput('project-c'),
        },
      });

      const projectB = createProject('project-b', 'libs/b');
      const projectC = createProject('project-c', 'libs/c');

      const pluginResultProjects = createPluginResult([
        projectA,
        projectB,
        projectC,
      ]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);

      // Only rename B — C stays the same
      renameProject(manager, 'libs/b', 'renamed-b');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'renamed-b', root: 'libs/b' },
        { name: 'project-c', root: 'libs/c' },
      ]);

      manager.applySubstitutions(rootMap);

      // B reference should be updated (dirty because renamed)
      expect(projectA.targets.build.inputs[0].projects).toBe('renamed-b');
      // C reference should still have the original name (not dirty, never renamed)
      expect(projectA.targets.test.inputs[0].projects).toBe('project-c');
    });
  });

  // ============== Edge Cases ==============

  describe('edge cases', () => {
    it('should handle projects without targets', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a');
      const pluginResultProjects = createPluginResult([projectA]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      renameProject(manager, 'libs/a', 'renamed-a');

      const rootMap = createRootMap([{ name: 'renamed-a', root: 'libs/a' }]);

      // Should not throw
      manager.applySubstitutions(rootMap);
    });

    it('should handle targets without inputs or dependsOn', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: {
            executor: 'nx:run-commands',
            options: { command: 'echo hello' },
          },
        },
      });

      const pluginResultProjects = createPluginResult([projectA]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      renameProject(manager, 'libs/a', 'renamed-a');

      const rootMap = createRootMap([
        { name: 'renamed-a', root: 'libs/a', targets: projectA.targets },
      ]);

      // Should not throw
      manager.applySubstitutions(rootMap);
    });

    it('should ignore malformed target entries during registration', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: null,
          test: createTargetWithProjectInput('project-b'),
        },
      });
      const projectB = createProject('project-b', 'libs/b');

      const malformedResult = createPluginResult([projectA, projectB]);
      identifyProjects(manager, malformedResult);
      expect(() =>
        manager.registerSubstitutorsForNodeResults(malformedResult)
      ).not.toThrow();

      renameProject(manager, 'libs/b', 'renamed-b');
      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'renamed-b', root: 'libs/b' },
      ]);
      manager.applySubstitutions(rootMap);

      expect(projectA.targets.test.inputs[0].projects).toBe('renamed-b');
    });

    it('should handle inputs with non-projects entries', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: {
            inputs: [
              'default',
              '{workspaceRoot}/.eslintrc.json',
              { externalDependencies: ['eslint'] },
              { input: 'default', projects: 'project-b' }, // Only this should be processed
            ],
          },
        },
      });

      const projectB = createProject('project-b', 'libs/b');

      const pluginResultProjects = createPluginResult([projectA, projectB]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      renameProject(manager, 'libs/b', 'renamed-b');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'renamed-b', root: 'libs/b' },
      ]);

      manager.applySubstitutions(rootMap);

      // Only the projects reference should be updated
      expect(projectA.targets.build.inputs[0]).toBe('default');
      expect(projectA.targets.build.inputs[1]).toBe(
        '{workspaceRoot}/.eslintrc.json'
      );
      expect(projectA.targets.build.inputs[2]).toEqual({
        externalDependencies: ['eslint'],
      });
      expect(projectA.targets.build.inputs[3].projects).toBe('renamed-b');
    });

    it('should handle dependsOn with non-object entries', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: {
            dependsOn: [
              '^build', // String entry, not an object
              { target: 'compile', projects: 'project-b' }, // Object entry
            ],
          },
        },
      });

      const projectB = createProject('project-b', 'libs/b');

      const pluginResultProjects = createPluginResult([projectA, projectB]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      renameProject(manager, 'libs/b', 'renamed-b');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'renamed-b', root: 'libs/b' },
      ]);

      manager.applySubstitutions(rootMap);

      // String entry should remain unchanged
      expect(projectA.targets.build.dependsOn[0]).toBe('^build');
      // Object entry should have project substituted
      expect(projectA.targets.build.dependsOn[1].projects).toBe('renamed-b');
    });

    it('should handle dependsOn without projects property', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: {
            dependsOn: [
              { target: 'build' }, // No projects property
            ],
          },
        },
      });

      const pluginResultProjects = createPluginResult([projectA]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      renameProject(manager, 'libs/a', 'renamed-a');

      const rootMap = createRootMap([
        { name: 'renamed-a', root: 'libs/a', targets: projectA.targets },
      ]);

      // Should not throw
      manager.applySubstitutions(rootMap);
      expect(projectA.targets.build.dependsOn[0].projects).toBeUndefined();
    });

    it('should handle referencing a non-existent project', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('non-existent'),
        },
      });

      const pluginResultProjects = createPluginResult([projectA]);

      // This should not throw, since the referenced project doesn't exist
      // No substitutor will be registered for it
      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
      ]);

      manager.applySubstitutions(rootMap);

      // The reference should remain unchanged since no substitutor was registered
      expect(projectA.targets.build.inputs[0].projects).toBe('non-existent');
    });

    it('should handle empty arrays in projects references', () => {
      const manager = createManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: {
            inputs: [{ input: 'default', projects: [] }],
            dependsOn: [{ target: 'build', projects: [] }],
          },
        },
      });

      const pluginResultProjects = createPluginResult([projectA]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      renameProject(manager, 'libs/a', 'renamed-a');

      const rootMap = createRootMap([
        { name: 'renamed-a', root: 'libs/a', targets: projectA.targets },
      ]);

      // Should not throw
      manager.applySubstitutions(rootMap);
    });
  });

  // ============== Integration with Merged Configurations ==============

  describe('integration with merged configurations', () => {
    it('should find projects in merged configurations when not in plugin result', () => {
      const manager = createManager();

      // Plugin 1: creates existing-project at libs/existing
      const existingProject = createProject(
        'existing-project',
        'libs/existing'
      );
      const existingResult = createPluginResult([existingProject]);
      identifyProjects(manager, existingResult);
      manager.registerSubstitutorsForNodeResults(existingResult);

      // Plugin 2: Project A references existing-project (from a different plugin result)
      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('existing-project'),
        },
      });
      const projectAResult = createPluginResult([projectA]);
      identifyProjects(manager, projectAResult);
      manager.registerSubstitutorsForNodeResults(projectAResult);

      renameProject(manager, 'libs/existing', 'renamed-existing');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'renamed-existing', root: 'libs/existing' },
      ]);

      manager.applySubstitutions(rootMap);

      expect(projectA.targets.build.inputs[0].projects).toBe(
        'renamed-existing'
      );
    });

    it('should prefer plugin result over merged configurations', () => {
      const manager = createManager();

      // Project A references project B which exists in both plugin result and merged configs
      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('project-b'),
        },
      });

      // B in plugin result (at libs/b-new)
      const projectBNew = createProject('project-b', 'libs/b-new');

      const pluginResultProjects = createPluginResult([projectA, projectBNew]);

      identifyProjects(manager, pluginResultProjects);
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      renameProject(manager, 'libs/b-new', 'renamed-b');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'renamed-b', root: 'libs/b-new' },
        { name: 'project-b', root: 'libs/b-old' },
      ]);

      manager.applySubstitutions(rootMap);

      // Should use the new location since it was found first in plugin result
      expect(projectA.targets.build.inputs[0].projects).toBe('renamed-b');
    });
  });

  // ============== Rename + New Project With Same Name ==============

  describe('rename with new project reusing old name', () => {
    it('should not substitute references to A when A is renamed to B and a new project takes name A', () => {
      // Scenario:
      //   Plugin 1 creates project "A" at libs/a (nothing depends on it)
      //   Plugin 2:
      //     - Renames libs/a from "A" to "B"
      //     - Adds a new project "A" at libs/new-a
      //     - Adds project C at libs/c that depends on "A"
      //
      // After merging, C's dependsOn "A" refers to the NEW project at
      // libs/new-a, NOT the renamed project at libs/a. Substitutions
      // should leave C's reference unchanged.

      const manager = createManager();

      // Plugin 1: creates project "A" at libs/a — nothing references it
      const originalA = createProject('A', 'libs/a');
      const plugin1Result = createPluginResult([originalA]);

      // Plugin 2: renames libs/a → "B", introduces new "A" at libs/new-a,
      // and project C that depends on "A" (the new one)
      const renamedA = createProject('B', 'libs/a');
      const newA = createProject('A', 'libs/new-a');
      const projectC = createProject('C', 'libs/c', {
        targets: {
          build: createTargetWithDependsOn('A'),
        },
      });
      const plugin2Result = createPluginResult([renamedA, newA, projectC]);

      identifyProjects(manager, plugin1Result);
      manager.registerSubstitutorsForNodeResults(plugin1Result);
      identifyProjects(manager, plugin2Result);
      manager.registerSubstitutorsForNodeResults(plugin2Result);

      // The merge phase detected that libs/a changed from "A" to "B"
      renameProject(manager, 'libs/a', 'B');

      const rootMap = createRootMap([
        { name: 'B', root: 'libs/a' },
        { name: 'A', root: 'libs/new-a' },
        { name: 'C', root: 'libs/c', targets: projectC.targets },
      ]);

      manager.applySubstitutions(rootMap);

      // C's dependsOn should still reference "A" (the new project),
      // NOT "B" (the renamed project)
      expect(projectC.targets.build.dependsOn[0].projects).toBe('A');
    });

    it('should not substitute input references to A when A is renamed to B and a new project takes name A', () => {
      const manager = createManager();

      // Plugin 1: creates project "A" at libs/a — nothing references it
      const originalA = createProject('A', 'libs/a');
      const plugin1Result = createPluginResult([originalA]);

      // Plugin 2: renames libs/a → "B", introduces new "A" at libs/new-a,
      // and project C with inputs referencing "A" (the new one)
      const renamedA = createProject('B', 'libs/a');
      const newA = createProject('A', 'libs/new-a');
      const projectC = createProject('C', 'libs/c', {
        targets: {
          build: createTargetWithProjectInput('A'),
        },
      });
      const plugin2Result = createPluginResult([renamedA, newA, projectC]);

      identifyProjects(manager, plugin1Result);
      manager.registerSubstitutorsForNodeResults(plugin1Result);
      identifyProjects(manager, plugin2Result);
      manager.registerSubstitutorsForNodeResults(plugin2Result);

      renameProject(manager, 'libs/a', 'B');

      const rootMap = createRootMap([
        { name: 'B', root: 'libs/a' },
        { name: 'A', root: 'libs/new-a' },
        { name: 'C', root: 'libs/c', targets: projectC.targets },
      ]);

      manager.applySubstitutions(rootMap);

      // C's input reference should still point to "A" (the new project)
      expect(projectC.targets.build.inputs[0].projects).toBe('A');
    });

    it('should not substitute array input references to A when A is renamed and a new project takes name A', () => {
      const manager = createManager();

      // Plugin 1: creates project "A" at libs/a — nothing references it
      const originalA = createProject('A', 'libs/a');
      const plugin1Result = createPluginResult([originalA]);

      // Plugin 2: renames libs/a → "B", introduces new "A", and project C
      // with array input referencing ["A", "other"]
      const renamedA = createProject('B', 'libs/a');
      const newA = createProject('A', 'libs/new-a');
      const otherProject = createProject('other', 'libs/other');
      const projectC = createProject('C', 'libs/c', {
        targets: {
          build: createTargetWithProjectInput(['A', 'other']),
        },
      });
      const plugin2Result = createPluginResult([
        renamedA,
        newA,
        otherProject,
        projectC,
      ]);

      identifyProjects(manager, plugin1Result);
      manager.registerSubstitutorsForNodeResults(plugin1Result);
      identifyProjects(manager, plugin2Result);
      manager.registerSubstitutorsForNodeResults(plugin2Result);

      renameProject(manager, 'libs/a', 'B');

      const rootMap = createRootMap([
        { name: 'B', root: 'libs/a' },
        { name: 'A', root: 'libs/new-a' },
        { name: 'other', root: 'libs/other' },
        { name: 'C', root: 'libs/c', targets: projectC.targets },
      ]);

      manager.applySubstitutions(rootMap);

      // "A" in the array should still point to the new project "A"
      expect((projectC.targets.build.inputs[0].projects as string[])[0]).toBe(
        'A'
      );
      expect((projectC.targets.build.inputs[0].projects as string[])[1]).toBe(
        'other'
      );
    });
  });

  // ============== Same-Project Colon Target Name Tests ==============

  describe('same-project colon target names in dependsOn', () => {
    it('should not substitute a dependsOn string that matches an owning project target name', () => {
      // Reproduces the real-world bug: devkit has a target literally named
      // "nx:echo" and a "parent" target with dependsOn: ["nx:echo"]. A
      // different project at root "." is transiently named "nx" by an early
      // plugin, then renamed to "@nx/nx-source". Without the fix, the
      // substitution manager incorrectly rewrites "nx:echo" →
      // "@nx/nx-source:echo" because it parses "nx:echo" as project "nx"
      // target "echo" and a dirty entry exists for the name "nx".
      const manager = createManager();

      // Project at root that transiently has name "nx", then renamed
      const rootProject = createProject('nx', 'root-dir');

      // The "nx" package — a separate project with a stable name "nx"
      const nxProject = createProject('nx', 'packages/nx');

      // devkit has a target literally named "nx:echo" and a "parent"
      // target that depends on it (same-project reference)
      const devkit = createProject('devkit', 'packages/devkit', {
        targets: {
          'nx:echo': {
            command: "echo 'Hello'",
          },
          parent: {
            dependsOn: ['nx:echo'],
          },
        },
      });

      // First plugin result: root project with name "nx"
      const plugin1Result = createPluginResult([rootProject]);
      identifyProjects(manager, plugin1Result);
      manager.registerSubstitutorsForNodeResults(plugin1Result);

      // Second plugin result: devkit with the colon target
      const plugin2Result = createPluginResult([nxProject, devkit]);
      identifyProjects(manager, plugin2Result);
      manager.registerSubstitutorsForNodeResults(plugin2Result);

      // Root project renamed from "nx" to "@nx/nx-source"
      renameProject(manager, 'root-dir', '@nx/nx-source');

      const rootMap = createRootMap([
        { name: '@nx/nx-source', root: 'root-dir' },
        { name: 'nx', root: 'packages/nx' },
        {
          name: 'devkit',
          root: 'packages/devkit',
          targets: devkit.targets,
        },
      ]);

      manager.applySubstitutions(rootMap);

      // "nx:echo" should remain unchanged — it is a same-project target,
      // not a cross-project reference to the "nx" project.
      expect(devkit.targets.parent.dependsOn[0]).toBe('nx:echo');
    });

    it('should substitute colon-prefixed cross-project dependsOn strings when all projects are renamed by a later plugin', () => {
      // Reproduces a Gradle-style workspace where:
      //   Plugin 1 (e.g. @nx/gradle) infers projects with colon-prefixed
      //   names and dependsOn entries like ":libs:java:kafka-stream:jar".
      //   The target names are only the last segment (e.g. "jar").
      //   Plugin 2 (e.g. package.json) renames ALL of those projects.
      const manager = createManager();

      // Plugin 1: Gradle plugin infers all projects in one result
      const compactor = createProject(
        ':apps:ovm-compactor',
        'apps/ovm-compactor',
        {
          targets: {
            compileTestJava: {},
            testClasses: {},
            classes: {},
            compileJava: {},
            test: {
              dependsOn: [
                ':apps:ovm-compactor:compileTestJava',
                ':apps:ovm-compactor:testClasses',
                ':apps:ovm-compactor:classes',
                ':apps:ovm-compactor:compileJava',
                ':libs:java:kafka-stream:jar',
                ':libs:java:split-client:jar',
              ],
            },
          },
        }
      );
      const kafkaStream = createProject(
        ':libs:java:kafka-stream',
        'libs/java/kafka-stream',
        {
          targets: { jar: {} },
        }
      );
      const splitClient = createProject(
        ':libs:java:split-client',
        'libs/java/split-client',
        {
          targets: { jar: {} },
        }
      );

      const plugin1Result = createPluginResult([
        compactor,
        kafkaStream,
        splitClient,
      ]);

      // Plugin 2: renames all projects (e.g. package.json names)
      const renamedCompactor = createProject(
        'ovm-compactor',
        'apps/ovm-compactor'
      );
      const renamedKafkaStream = createProject(
        'kafka-stream',
        'libs/java/kafka-stream'
      );
      const renamedSplitClient = createProject(
        'split-client',
        'libs/java/split-client'
      );

      const plugin2Result = createPluginResult([
        renamedCompactor,
        renamedKafkaStream,
        renamedSplitClient,
      ]);

      // Merge-before-register: identify plugin1 projects, then register
      renameProject(manager, 'apps/ovm-compactor', ':apps:ovm-compactor');
      renameProject(
        manager,
        'libs/java/kafka-stream',
        ':libs:java:kafka-stream'
      );
      renameProject(
        manager,
        'libs/java/split-client',
        ':libs:java:split-client'
      );
      manager.registerSubstitutorsForNodeResults(plugin1Result);

      // Plugin 2 renames all projects — identify new names, then register
      renameProject(manager, 'apps/ovm-compactor', 'ovm-compactor');
      renameProject(manager, 'libs/java/kafka-stream', 'kafka-stream');
      renameProject(manager, 'libs/java/split-client', 'split-client');
      manager.registerSubstitutorsForNodeResults(plugin2Result);

      const rootMap = createRootMap([
        {
          name: 'ovm-compactor',
          root: 'apps/ovm-compactor',
          targets: compactor.targets,
        },
        { name: 'kafka-stream', root: 'libs/java/kafka-stream' },
        { name: 'split-client', root: 'libs/java/split-client' },
      ]);

      manager.applySubstitutions(rootMap);

      const dependsOn = compactor.targets.test.dependsOn;
      // Same-project refs should use the new name
      expect(dependsOn[0]).toBe('ovm-compactor:compileTestJava');
      expect(dependsOn[1]).toBe('ovm-compactor:testClasses');
      expect(dependsOn[2]).toBe('ovm-compactor:classes');
      expect(dependsOn[3]).toBe('ovm-compactor:compileJava');
      // Cross-project refs should use the new names
      expect(dependsOn[4]).toBe('kafka-stream:jar');
      expect(dependsOn[5]).toBe('split-client:jar');
    });

    it('should still substitute genuine cross-project "project:target" references', () => {
      const manager = createManager();

      // Project B has a "compile" target
      const projectB = createProject('project-b', 'libs/b', {
        targets: { compile: {} },
      });

      // Project A references project-b:compile (a real cross-project ref)
      // and does NOT have a target named "project-b:compile"
      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: {
            dependsOn: ['project-b:compile'],
          },
        },
      });

      const crossProjectResult = createPluginResult([projectA, projectB]);
      identifyProjects(manager, crossProjectResult);
      manager.registerSubstitutorsForNodeResults(crossProjectResult);
      renameProject(manager, 'libs/b', 'renamed-b');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'renamed-b', root: 'libs/b' },
      ]);

      manager.applySubstitutions(rootMap);

      // The genuine cross-project reference should be substituted
      expect(projectA.targets.build.dependsOn[0]).toBe('renamed-b:compile');
    });
  });
});
