import { TargetConfiguration, TargetDependencyConfig } from '@nx/devkit';

interface TestClass {
  className: string;
  packagePath: string;
  filePath: string;
  packageName?: string;
}

interface MavenProjectData {
  projectName: string;
  testClasses: TestClass[];
  hasTests: boolean;
  [key: string]: any;
}

const TEST_CI_TARGET_GROUP = 'test';

/**
 * Add test CI atomized targets for a Maven project
 * Based on Gradle's test atomization implementation
 */
export function addTestCiTargets(
  projectData: MavenProjectData,
  targets: Record<string, TargetConfiguration>,
  targetGroups: Record<string, string[]>,
  projectRoot: string,
  ciTestTargetName: string = 'test-ci'
): void {
  if (!projectData.testClasses || projectData.testClasses.length === 0) {
    return;
  }

  ensureTargetGroupExists(targetGroups, TEST_CI_TARGET_GROUP);

  const ciDependsOn: TargetDependencyConfig[] = [];

  // Process each test class to create atomized targets
  for (const testClass of projectData.testClasses) {
    const atomizedTargetName = `${ciTestTargetName}--${testClass.className}`;
    
    // Create atomized test target
    targets[atomizedTargetName] = buildTestCiTarget(
      projectData.projectName,
      testClass.packagePath,
      projectRoot
    );

    // Add to target group
    if (!targetGroups[TEST_CI_TARGET_GROUP]) {
      targetGroups[TEST_CI_TARGET_GROUP] = [];
    }
    targetGroups[TEST_CI_TARGET_GROUP].push(atomizedTargetName);

    // Add dependency for parent CI target
    ciDependsOn.push({
      target: atomizedTargetName,
      projects: 'self', 
      params: 'forward' as const
    });
  }

  // Create parent CI target that runs all atomized tests
  if (ciDependsOn.length > 0) {
    targets[ciTestTargetName] = {
      executor: 'nx:noop',
      metadata: {
        description: 'Runs all Maven tests in CI',
        technologies: ['maven']
      },
      cache: true,
      dependsOn: ciDependsOn,
      inputs: [
        'default',
        '^default',
        '{projectRoot}/src/test/**/*',
        '{projectRoot}/pom.xml'
      ]
    };

    targetGroups[TEST_CI_TARGET_GROUP].push(ciTestTargetName);
  }
}

/**
 * Build an individual atomized test target
 */
function buildTestCiTarget(
  projectName: string,
  testClassPackagePath: string,
  projectRoot: string
): TargetConfiguration {
  return {
    executor: 'nx:run-commands',
    options: {
      command: `mvn test -Dtest=${testClassPackagePath}`,
      cwd: projectRoot
    },
    metadata: {
      description: `Runs Maven test ${testClassPackagePath} in CI`,
      technologies: ['maven']
    },
    cache: true,
    inputs: [
      'default',
      '^default',
      '{projectRoot}/src/test/**/*',
      '{projectRoot}/src/main/**/*',
      '{projectRoot}/pom.xml'
    ],
    outputs: [
      '{projectRoot}/target/surefire-reports',
      '{projectRoot}/target/test-classes'
    ]
  };
}

/**
 * Ensure a target group exists in the targetGroups map
 */
function ensureTargetGroupExists(targetGroups: Record<string, string[]>, group: string): void {
  if (!targetGroups[group]) {
    targetGroups[group] = [];
  }
}

/**
 * Check if test atomization should be enabled for a project
 */
export function shouldEnableTestAtomization(
  projectData: MavenProjectData,
  atomizationOptions: { enabled?: boolean; minTestClasses?: number } = {}
): boolean {
  const { enabled = false, minTestClasses = 1 } = atomizationOptions;

  if (!enabled) {
    return false;
  }

  if (!projectData.hasTests) {
    return false;
  }

  if (!projectData.testClasses || projectData.testClasses.length < minTestClasses) {
    return false;
  }

  return true;
}