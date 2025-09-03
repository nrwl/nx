import { createNodesV2 } from './plugins/nodes';
import { createDependencies } from './plugins/dependencies';
import { CreateNodesContext, CreateDependenciesContext, DependencyType } from '@nx/devkit';
import { vol } from 'memfs';
import { join } from 'path';

// Mock file system
jest.mock('fs', () => ({
  ...jest.requireActual('memfs').fs,
  existsSync: jest.requireActual('memfs').fs.existsSync,
  readFileSync: jest.requireActual('memfs').fs.readFileSync,
}));

jest.mock('child_process', () => ({
  spawn: jest.fn().mockImplementation(() => ({
    on: jest.fn((event, cb) => {
      if (event === 'close') cb(0);
    }),
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() }
  }))
}));

describe('Maven Plugin', () => {
  const workspaceRoot = '/workspace';
  
  beforeEach(() => {
    vol.reset();
    // Clear any cached data
    jest.clearAllMocks();
    process.env.NX_VERBOSE_LOGGING = 'false';
  });

  describe('createNodesV2', () => {
    const context: CreateNodesContext = {
      workspaceRoot,
      configFiles: [],
      nxJsonConfiguration: {},
    };

    const mockMavenAnalysisData = {
      projects: [
        {
          artifactId: 'maven-core',
          groupId: 'org.apache.maven',
          version: '4.1.0-SNAPSHOT',
          packaging: 'jar',
          name: 'Maven Core',
          description: 'Maven Core classes',
          root: 'impl/maven-core',
          projectType: 'application',
          sourceRoot: 'impl/maven-core/src/main/java',
          dependencies: [
            {
              groupId: 'org.apache.maven',
              artifactId: 'maven-api-core',
              version: '4.1.0-SNAPSHOT',
              scope: 'compile'
            }
          ],
          tags: ['maven:org.apache.maven', 'maven:jar'],
          hasTests: true,
          hasResources: true,
          lifecycle: {
            phases: ['validate', 'compile', 'test', 'package', 'install'],
            commonPhases: ['validate', 'compile', 'test', 'package', 'install'],
            goals: [
              {
                plugin: 'maven-compiler-plugin',
                goal: 'compile',
                phase: 'compile'
              },
              {
                plugin: 'maven-surefire-plugin', 
                goal: 'test',
                phase: 'test'
              }
            ],
            plugins: []
          }
        },
        {
          artifactId: 'maven-api-core',
          groupId: 'org.apache.maven',
          version: '4.1.0-SNAPSHOT',
          packaging: 'jar',
          name: 'Maven API Core',
          description: 'Maven API Core',
          root: 'api/maven-api-core',
          projectType: 'library',
          sourceRoot: 'api/maven-api-core/src/main/java',
          dependencies: [],
          tags: ['maven:org.apache.maven', 'maven:jar'],
          hasTests: false,
          hasResources: false,
          lifecycle: {
            phases: ['validate', 'compile', 'package', 'install'],
            commonPhases: ['validate', 'compile', 'package', 'install'],
            goals: [
              {
                plugin: 'maven-compiler-plugin',
                goal: 'compile',
                phase: 'compile'
              }
            ],
            plugins: []
          }
        }
      ],
      generatedAt: Date.now(),
      workspaceRoot: workspaceRoot,
      totalProjects: 2
    };

    it('should return empty array when no root pom.xml exists', async () => {
      const configFiles = ['sub-project/pom.xml'];
      const [, createNodesFn] = createNodesV2;
      
      const result = await createNodesFn(configFiles, {}, context);
      
      expect(result).toEqual([]);
    });

    it('should process projects when root pom.xml exists and analysis data is available', async () => {
      // Setup file system
      vol.fromJSON({
        [join(workspaceRoot, 'pom.xml')]: '<project></project>',
        [join(workspaceRoot, '.nx/workspace-data/nx-maven-projects.json')]: JSON.stringify(mockMavenAnalysisData)
      });

      const configFiles = ['pom.xml'];
      const [, createNodesFn] = createNodesV2;
      
      const result = await createNodesFn(configFiles, { verbose: false }, context);
      
      expect(result).toMatchSnapshot('maven-projects-nodes');
      expect(result).toHaveLength(2);
      
      // Check first project structure
      const firstProject = result[0];
      expect(firstProject).toBeDefined();
      expect(firstProject[0]).toBe('impl/maven-core');
      
      const projectConfig = firstProject[1]?.projects?.['impl/maven-core'];
      expect(projectConfig).toBeDefined();
      expect(projectConfig?.name).toBe('org.apache.maven.maven-core');
      expect(projectConfig?.targets).toHaveProperty('validate');
      expect(projectConfig?.targets).toHaveProperty('compile');
      expect(projectConfig?.targets).toHaveProperty('test');
      expect(projectConfig?.targets).toHaveProperty('maven-compiler-plugin-compile');
    });

    it('should generate correct targets from lifecycle data', async () => {
      vol.fromJSON({
        [join(workspaceRoot, 'pom.xml')]: '<project></project>',
        [join(workspaceRoot, '.nx/workspace-data/nx-maven-projects.json')]: JSON.stringify(mockMavenAnalysisData)
      });

      const configFiles = ['pom.xml'];
      const [, createNodesFn] = createNodesV2;
      
      const result = await createNodesFn(configFiles, {}, context);
      
      const coreProject = result[0]?.[1]?.projects?.['impl/maven-core'];
      expect(coreProject).toBeDefined();
      
      // Check phase targets
      expect(coreProject?.targets?.validate).toEqual({
        executor: 'nx:run-commands',
        options: {
          command: 'mvn validate -pl org.apache.maven:maven-core',
          cwd: '{workspaceRoot}'
        }
      });

      // Check goal targets
      expect(coreProject?.targets?.['maven-compiler-plugin-compile']).toEqual({
        executor: 'nx:run-commands',
        options: {
          command: 'mvn maven-compiler-plugin:compile -pl org.apache.maven:maven-core',
          cwd: '{workspaceRoot}'
        }
      });
    });

    it('should handle projects with no lifecycle data gracefully', async () => {
      const projectWithoutLifecycle = {
        ...mockMavenAnalysisData,
        projects: [{
          ...mockMavenAnalysisData.projects[0],
          lifecycle: null
        }]
      };

      vol.fromJSON({
        [join(workspaceRoot, 'pom.xml')]: '<project></project>',
        [join(workspaceRoot, '.nx/workspace-data/nx-maven-projects.json')]: JSON.stringify(projectWithoutLifecycle)
      });

      const configFiles = ['pom.xml'];
      const [, createNodesFn] = createNodesV2;
      
      const result = await createNodesFn(configFiles, {}, context);
      
      const coreProject = result[0]?.[1]?.projects?.['impl/maven-core'];
      expect(coreProject).toBeDefined();
      
      // Should have fallback targets
      expect(coreProject?.targets).toHaveProperty('compile');
      expect(coreProject?.targets).toHaveProperty('test');
      expect(coreProject?.targets).toHaveProperty('clean');
    });
  });

  describe('createDependencies', () => {
    const context: CreateDependenciesContext = {
      workspaceRoot,
      projects: {},
      externalNodes: {},
      fileMap: { projectFileMap: {}, nonProjectFiles: [] },
      filesToProcess: { projectFileMap: {}, nonProjectFiles: [] },
      nxJsonConfiguration: {}
    };

    const mockMavenAnalysisData = {
      projects: [
        {
          artifactId: 'maven-core',
          groupId: 'org.apache.maven',
          dependencies: [
            {
              groupId: 'org.apache.maven',
              artifactId: 'maven-api-core',
              version: '4.1.0-SNAPSHOT',
              scope: 'compile'
            },
            {
              groupId: 'org.apache.maven',
              artifactId: 'maven-model',
              version: '4.1.0-SNAPSHOT', 
              scope: 'compile'
            },
            {
              groupId: 'external.library',
              artifactId: 'external-lib',
              version: '1.0.0',
              scope: 'compile'
            }
          ]
        },
        {
          artifactId: 'maven-api-core',
          groupId: 'org.apache.maven',
          dependencies: [
            {
              groupId: 'org.apache.maven',
              artifactId: 'maven-model',
              version: '4.1.0-SNAPSHOT',
              scope: 'compile'
            }
          ]
        },
        {
          artifactId: 'maven-model',
          groupId: 'org.apache.maven',
          dependencies: []
        }
      ]
    };

    beforeEach(() => {
      vol.fromJSON({
        [join(workspaceRoot, '.nx/workspace-data/nx-maven-projects.json')]: JSON.stringify(mockMavenAnalysisData)
      });
    });

    it('should create dependencies between reactor projects', () => {
      const result = createDependencies({}, context);
      
      expect(result).toMatchSnapshot('maven-dependencies');
      expect(result).toHaveLength(3);
      
      // Check specific dependencies
      expect(result).toContainEqual({
        source: 'org.apache.maven.maven-core',
        target: 'org.apache.maven.maven-api-core',
        type: DependencyType.static,
        sourceFile: 'pom.xml'
      });

      expect(result).toContainEqual({
        source: 'org.apache.maven.maven-core',
        target: 'org.apache.maven.maven-model',
        type: DependencyType.static,
        sourceFile: 'pom.xml'
      });

      expect(result).toContainEqual({
        source: 'org.apache.maven.maven-api-core',
        target: 'org.apache.maven.maven-model',
        type: DependencyType.static,
        sourceFile: 'pom.xml'
      });
    });

    it('should ignore external dependencies not in reactor', () => {
      const result = createDependencies({}, context);
      
      // Should not include dependency to external.library:external-lib
      expect(result).not.toContainEqual(
        expect.objectContaining({
          target: 'external.library.external-lib'
        })
      );
    });

    it('should return empty array when analysis file does not exist', () => {
      vol.fromJSON({}); // Empty file system
      
      const result = createDependencies({}, context);
      
      expect(result).toEqual([]);
    });

    it('should handle malformed analysis data gracefully', () => {
      vol.fromJSON({
        [join(workspaceRoot, '.nx/workspace-data/nx-maven-projects.json')]: 'invalid json'
      });
      
      const result = createDependencies({}, context);
      
      expect(result).toEqual([]);
    });

    it('should handle projects without dependencies', () => {
      const dataWithoutDeps = {
        projects: [
          {
            artifactId: 'standalone-project',
            groupId: 'org.apache.maven',
            dependencies: []
          }
        ]
      };

      vol.fromJSON({
        [join(workspaceRoot, '.nx/workspace-data/nx-maven-projects.json')]: JSON.stringify(dataWithoutDeps)
      });
      
      const result = createDependencies({}, context);
      
      expect(result).toEqual([]);
    });

    it('should not create self-dependencies', () => {
      const dataWithSelfDep = {
        projects: [
          {
            artifactId: 'maven-core',
            groupId: 'org.apache.maven',
            dependencies: [
              {
                groupId: 'org.apache.maven',
                artifactId: 'maven-core', // Self dependency
                version: '4.1.0-SNAPSHOT',
                scope: 'compile'
              }
            ]
          }
        ]
      };

      vol.fromJSON({
        [join(workspaceRoot, '.nx/workspace-data/nx-maven-projects.json')]: JSON.stringify(dataWithSelfDep)
      });
      
      const result = createDependencies({}, context);
      
      expect(result).toEqual([]);
    });
  });
});