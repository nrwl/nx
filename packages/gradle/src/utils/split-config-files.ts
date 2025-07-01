import { combineGlobPatterns } from 'nx/src/utils/globs';
import { basename, dirname } from 'node:path';
import { minimatch } from 'minimatch';

export const GRADLE_BUILD_PATTERNS = ['*.gradle', '*.gradle.kts'];
export const SETTINGS_GRADLE_FILES = ['settings.gradle', 'settings.gradle.kts'];
export const GRADLEW_FILES = new Set(['gradlew', 'gradlew.bat']);
export const GRADLE_TEST_FILES = [
  '**/src/test/java/**/*Test.java',
  '**/src/test/kotlin/**/*Test.kt',
  '**/src/test/java/**/*Tests.java',
  '**/src/test/kotlin/**/*Tests.kt',
  '**/src/test/groovy/**/*Test.groovy',
  '**/src/test/groovy/**/*Tests.groovy',
];

export const gradleConfigGlob = combineGlobPatterns(
  ...GRADLE_BUILD_PATTERNS.map((file) => `**/${file}`)
);

export const gradleConfigAndTestGlob = combineGlobPatterns(
  ...GRADLE_BUILD_PATTERNS,
  ...GRADLE_BUILD_PATTERNS.map((file) => `**/${file}`),
  ...Array.from(GRADLEW_FILES),
  ...Array.from(GRADLEW_FILES).map((file) => `**/${file}`),
  ...GRADLE_TEST_FILES
);

export function isGradleBuildFile(filename: string): boolean {
  return (
    GRADLE_BUILD_PATTERNS.some((pattern) => minimatch(filename, pattern)) &&
    !SETTINGS_GRADLE_FILES.includes(filename)
  );
}

/**
 * This function split config files into build files, settings files, test files and project roots
 * @param files list of files to split
 * @returns object with buildFiles, gradlewFiles, testFiles and projectRoots
 * For gradlewFiles, it will start with settings files and find the nearest gradlew file in the workspace
 */
export function splitConfigFiles(files: readonly string[]): {
  buildFiles: string[];
  gradlewFiles: string[];
  settingsFiles: string[];
  testFiles: string[];
  projectRoots: string[];
} {
  const buildFiles = [];
  const testFiles = [];
  const gradlewFiles = [];
  const settingsFiles = [];
  const projectRoots = new Set<string>();

  files.forEach((file) => {
    const filename = basename(file);
    const fileDirectory = dirname(file);
    if (SETTINGS_GRADLE_FILES.includes(filename)) {
      settingsFiles.push(file);
    } else if (isGradleBuildFile(filename)) {
      buildFiles.push(file);
      projectRoots.add(fileDirectory);
    } else if (GRADLEW_FILES.has(filename)) {
      if (process.platform.startsWith('win')) {
        if (filename === 'gradlew.bat') {
          gradlewFiles.push(file);
        }
      } else {
        if (filename === 'gradlew') {
          gradlewFiles.push(file);
        }
      }
    } else if (GRADLE_TEST_FILES.some((pattern) => minimatch(file, pattern))) {
      testFiles.push(file);
    }
  });

  return {
    buildFiles,
    testFiles,
    gradlewFiles,
    settingsFiles,
    projectRoots: Array.from(projectRoots),
  };
}
