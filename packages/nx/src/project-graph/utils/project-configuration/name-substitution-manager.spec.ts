import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import { ProjectNameInNodePropsManager } from './name-substitution-manager';

describe('ProjectNameInNodePropsManager', () => {
  // ============== Helper Functions ==============

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
      const manager = new ProjectNameInNodePropsManager();
      expect(manager).toBeDefined();
    });

    it('should handle empty plugin results without errors', () => {
      const manager = new ProjectNameInNodePropsManager();
      manager.registerSubstitutorsForNodeResults({});
      manager.applySubstitutions({});
      // No error should be thrown
    });

    it('should handle undefined plugin results', () => {
      const manager = new ProjectNameInNodePropsManager();
      manager.registerSubstitutorsForNodeResults(undefined);
      // No error should be thrown
    });
  });

  // ============== Input Projects Reference Tests ==============

  describe('inputs with projects reference', () => {
    it('should substitute a single project name in inputs.projects (string)', () => {
      const manager = new ProjectNameInNodePropsManager();

      // Project A references project B by name in its inputs
      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('project-b'),
        },
      });

      const projectB = createProject('project-b', 'libs/b');

      const pluginResultProjects = createPluginResult([projectA, projectB]);

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);

      // Simulate project B's name being changed
      manager.markDirty('libs/b', 'project-b');

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
      const manager = new ProjectNameInNodePropsManager();

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

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);

      // Simulate both projects being renamed
      manager.markDirty('libs/b', 'project-b');
      manager.markDirty('libs/c', 'project-c');

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
      const manager = new ProjectNameInNodePropsManager();

      const projectAInitial = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput(['project-b', 'project-c']),
        },
      });

      manager.registerSubstitutorsForNodeResults(
        createPluginResult([projectAInitial])
      );

      const projectAUpdated = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput(['project-b']),
        },
      });

      manager.registerSubstitutorsForNodeResults(
        createPluginResult([projectAUpdated])
      );
      manager.markDirty('libs/c', 'project-c');

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
      const manager = new ProjectNameInNodePropsManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('self'),
        },
      });

      const pluginResultProjects = createPluginResult([projectA]);

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);

      // Even if we mark this dirty, 'self' should not be substituted
      manager.markDirty('libs/a', 'project-a');

      const rootMap = createRootMap([
        { name: 'renamed-a', root: 'libs/a', targets: projectA.targets },
      ]);

      manager.applySubstitutions(rootMap);

      // 'self' should remain unchanged
      expect(projectA.targets.build.inputs[0].projects).toBe('self');
    });

    it('should not substitute "dependencies" in inputs.projects', () => {
      const manager = new ProjectNameInNodePropsManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('dependencies'),
        },
      });

      const pluginResultProjects = createPluginResult([projectA]);

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      manager.markDirty('libs/a', 'project-a');

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
      const manager = new ProjectNameInNodePropsManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithDependsOn('project-b'),
        },
      });

      const projectB = createProject('project-b', 'libs/b');

      const pluginResultProjects = createPluginResult([projectA, projectB]);

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      manager.markDirty('libs/b', 'project-b');

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
      const manager = new ProjectNameInNodePropsManager();

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

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      manager.markDirty('libs/b', 'project-b');
      manager.markDirty('libs/c', 'project-c');

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
      const manager = new ProjectNameInNodePropsManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithDependsOn('*'),
        },
      });

      const pluginResultProjects = createPluginResult([projectA]);

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      manager.markDirty('libs/a', 'project-a');

      const rootMap = createRootMap([
        { name: 'renamed-a', root: 'libs/a', targets: projectA.targets },
      ]);

      manager.applySubstitutions(rootMap);

      expect(projectA.targets.build.dependsOn[0].projects).toBe('*');
    });

    it('should not substitute "self" in dependsOn.projects', () => {
      const manager = new ProjectNameInNodePropsManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithDependsOn('self'),
        },
      });

      const pluginResultProjects = createPluginResult([projectA]);

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      manager.markDirty('libs/a', 'project-a');

      const rootMap = createRootMap([
        { name: 'renamed-a', root: 'libs/a', targets: projectA.targets },
      ]);

      manager.applySubstitutions(rootMap);

      expect(projectA.targets.build.dependsOn[0].projects).toBe('self');
    });

    it('should not substitute "dependencies" in dependsOn.projects', () => {
      const manager = new ProjectNameInNodePropsManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithDependsOn('dependencies'),
        },
      });

      const pluginResultProjects = createPluginResult([projectA]);

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      manager.markDirty('libs/a', 'project-a');

      const rootMap = createRootMap([
        { name: 'renamed-a', root: 'libs/a', targets: projectA.targets },
      ]);

      manager.applySubstitutions(rootMap);

      expect(projectA.targets.build.dependsOn[0].projects).toBe('dependencies');
    });

    it('should not substitute glob patterns in dependsOn.projects array', () => {
      const manager = new ProjectNameInNodePropsManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithDependsOn(['lib-*', 'project-b']),
        },
      });

      const projectB = createProject('project-b', 'libs/b');

      const pluginResultProjects = createPluginResult([projectA, projectB]);

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      manager.markDirty('libs/b', 'project-b');

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
      const manager = new ProjectNameInNodePropsManager();

      const projectAInitial = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithDependsOn(['project-b', 'project-c']),
        },
      });

      manager.registerSubstitutorsForNodeResults(
        createPluginResult([projectAInitial])
      );

      const projectAUpdated = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithDependsOn(['project-b']),
        },
      });

      manager.registerSubstitutorsForNodeResults(
        createPluginResult([projectAUpdated])
      );
      manager.markDirty('libs/c', 'project-c');

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
      const manager = new ProjectNameInNodePropsManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          'build-*': createTargetWithDependsOn('project-b'),
        },
      });

      manager.registerSubstitutorsForNodeResults(
        createPluginResult([projectA])
      );
      manager.markDirty('libs/b', 'project-b');

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
      const manager = new ProjectNameInNodePropsManager();

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

      manager.registerSubstitutorsForNodeResults(projAResult);
      manager.registerSubstitutorsForNodeResults(projBResult);
      manager.markDirty('proj-b', 'project-b-original');
      manager.applySubstitutions(projectRootMap);

      expect(projA.targets.build.dependsOn[0].projects).toBe(
        'project-b-renamed'
      );
    });

    it('should handle registering substitutors from multiple plugin calls', () => {
      const manager = new ProjectNameInNodePropsManager();

      // First plugin creates projects A and B, where A references B
      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('project-b'),
        },
      });
      const projectB = createProject('project-b', 'libs/b');

      const firstPluginResult = createPluginResult([projectA, projectB]);

      manager.registerSubstitutorsForNodeResults(firstPluginResult);

      // Second plugin creates projects C and D, where C references D
      const projectC = createProject('project-c', 'libs/c', {
        targets: {
          test: createTargetWithProjectInput('project-d'),
        },
      });
      const projectD = createProject('project-d', 'libs/d');

      const secondPluginResult = createPluginResult([projectC, projectD]);

      manager.registerSubstitutorsForNodeResults(secondPluginResult);

      // Mark both B and D as dirty
      manager.markDirty('libs/b', 'project-b');
      manager.markDirty('libs/d', 'project-d');

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
      const manager = new ProjectNameInNodePropsManager();

      // First plugin creates project B
      const projectB = createProject('project-b', 'libs/b');
      const firstPluginResult = createPluginResult([projectB]);
      manager.registerSubstitutorsForNodeResults(firstPluginResult);

      // Second plugin creates project A that references B (which is in merged configs)
      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('project-b'),
        },
      });
      const secondPluginResult = createPluginResult([projectA]);

      manager.registerSubstitutorsForNodeResults(secondPluginResult);

      // Mark B as dirty
      manager.markDirty('libs/b', 'project-b');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'renamed-b', root: 'libs/b' },
      ]);

      manager.applySubstitutions(rootMap);

      expect(projectA.targets.build.inputs[0].projects).toBe('renamed-b');
    });

    it('should handle sequential registrations with overlapping projects', () => {
      const manager = new ProjectNameInNodePropsManager();

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
      manager.registerSubstitutorsForNodeResults(firstResult);

      // Second call
      const secondResult = createPluginResult([projectB]);
      manager.registerSubstitutorsForNodeResults(secondResult);

      // Rename shared-lib
      manager.markDirty('libs/shared', 'shared-lib');

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
      const manager = new ProjectNameInNodePropsManager();

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

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);

      // Rename all referenced projects
      manager.markDirty('libs/b', 'project-b');
      manager.markDirty('libs/c', 'project-c');
      manager.markDirty('libs/d', 'project-d');

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
      const manager = new ProjectNameInNodePropsManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('project-b-original'),
        },
      });
      const projectC = createProject('project-c', 'libs/c', {
        targets: {
          build: createTargetWithProjectInput('project-b-intermediate'),
        },
      });

      const projectB = createProject('project-b-original', 'libs/b');

      const pluginResultProjects = createPluginResult([
        projectA,
        projectB,
        projectC,
      ]);

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);

      // project-b-original -> project-b-intermediate -> project-b-final
      manager.markDirty('libs/b', 'project-b-original');
      manager.markDirty('libs/b', 'project-b-intermediate');
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
      const manager = new ProjectNameInNodePropsManager();

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

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);

      // Rename both projects
      manager.markDirty('libs/a', 'project-a');
      manager.markDirty('libs/b', 'project-b');

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
      const manager = new ProjectNameInNodePropsManager();
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
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);

      // Mark all as dirty
      for (let i = 0; i < projectCount; i++) {
        manager.markDirty(`libs/project-${i}`, `project-${i}`);
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
      const manager = new ProjectNameInNodePropsManager();

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

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);

      // Only mark B as dirty
      manager.markDirty('libs/b', 'project-b');

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'renamed-b', root: 'libs/b' },
        { name: 'renamed-c', root: 'libs/c' }, // C is renamed but not marked dirty
      ]);

      manager.applySubstitutions(rootMap);

      // B reference should be updated
      expect(projectA.targets.build.inputs[0].projects).toBe('renamed-b');
      // C reference should still have the original name (not marked dirty)
      expect(projectA.targets.test.inputs[0].projects).toBe('project-c');
    });
  });

  // ============== Edge Cases ==============

  describe('edge cases', () => {
    it('should handle projects without targets', () => {
      const manager = new ProjectNameInNodePropsManager();

      const projectA = createProject('project-a', 'libs/a');
      const pluginResultProjects = createPluginResult([projectA]);

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      manager.markDirty('libs/a', 'project-a');

      const rootMap = createRootMap([{ name: 'renamed-a', root: 'libs/a' }]);

      // Should not throw
      manager.applySubstitutions(rootMap);
    });

    it('should handle targets without inputs or dependsOn', () => {
      const manager = new ProjectNameInNodePropsManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: {
            executor: 'nx:run-commands',
            options: { command: 'echo hello' },
          },
        },
      });

      const pluginResultProjects = createPluginResult([projectA]);

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      manager.markDirty('libs/a', 'project-a');

      const rootMap = createRootMap([
        { name: 'renamed-a', root: 'libs/a', targets: projectA.targets },
      ]);

      // Should not throw
      manager.applySubstitutions(rootMap);
    });

    it('should ignore malformed target entries during registration', () => {
      const manager = new ProjectNameInNodePropsManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: null,
          test: createTargetWithProjectInput('project-b'),
        },
      });
      const projectB = createProject('project-b', 'libs/b');

      expect(() =>
        manager.registerSubstitutorsForNodeResults(
          createPluginResult([projectA, projectB])
        )
      ).not.toThrow();

      manager.markDirty('libs/b', 'project-b');
      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
        { name: 'renamed-b', root: 'libs/b' },
      ]);
      manager.applySubstitutions(rootMap);

      expect(projectA.targets.test.inputs[0].projects).toBe('renamed-b');
    });

    it('should handle inputs with non-projects entries', () => {
      const manager = new ProjectNameInNodePropsManager();

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

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      manager.markDirty('libs/b', 'project-b');

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
      const manager = new ProjectNameInNodePropsManager();

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

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      manager.markDirty('libs/b', 'project-b');

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
      const manager = new ProjectNameInNodePropsManager();

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

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      manager.markDirty('libs/a', 'project-a');

      const rootMap = createRootMap([
        { name: 'renamed-a', root: 'libs/a', targets: projectA.targets },
      ]);

      // Should not throw
      manager.applySubstitutions(rootMap);
      expect(projectA.targets.build.dependsOn[0].projects).toBeUndefined();
    });

    it('should handle referencing a non-existent project', () => {
      const manager = new ProjectNameInNodePropsManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('non-existent'),
        },
      });

      const pluginResultProjects = createPluginResult([projectA]);

      // This should not throw, since the referenced project doesn't exist
      // No substitutor will be registered for it
      manager.registerSubstitutorsForNodeResults(pluginResultProjects);

      const rootMap = createRootMap([
        { name: 'project-a', root: 'libs/a', targets: projectA.targets },
      ]);

      manager.applySubstitutions(rootMap);

      // The reference should remain unchanged since no substitutor was registered
      expect(projectA.targets.build.inputs[0].projects).toBe('non-existent');
    });

    it('should handle empty arrays in projects references', () => {
      const manager = new ProjectNameInNodePropsManager();

      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: {
            inputs: [{ input: 'default', projects: [] }],
            dependsOn: [{ target: 'build', projects: [] }],
          },
        },
      });

      const pluginResultProjects = createPluginResult([projectA]);

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      manager.markDirty('libs/a', 'project-a');

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
      const manager = new ProjectNameInNodePropsManager();

      // Project A references project B, but B is not in this plugin's result
      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('existing-project'),
        },
      });

      const pluginResultProjects = createPluginResult([projectA]);

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      manager.markDirty('libs/existing', 'existing-project');

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
      const manager = new ProjectNameInNodePropsManager();

      // Project A references project B which exists in both plugin result and merged configs
      const projectA = createProject('project-a', 'libs/a', {
        targets: {
          build: createTargetWithProjectInput('project-b'),
        },
      });

      // B in plugin result (at libs/b-new)
      const projectBNew = createProject('project-b', 'libs/b-new');

      const pluginResultProjects = createPluginResult([projectA, projectBNew]);

      manager.registerSubstitutorsForNodeResults(pluginResultProjects);
      manager.markDirty('libs/b-new', 'project-b');

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
});
