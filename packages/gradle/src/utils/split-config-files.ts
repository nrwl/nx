import { combineGlobPatterns } from 'nx/src/utils/globs';
import { basename, dirname } from 'node:path';

export const GRADLE_BUILD_FILES = new Set(['build.gradle', 'build.gradle.kts']);
export const GRALDEW_FILES = new Set(['gradlew', 'gradlew.bat']);
export const GRADLE_TEST_FILES = [
  '**/src/test/java/**/*Test.java',
  '**/src/test/kotlin/**/*Test.kt',
  '**/src/test/java/**/*Tests.java',
  '**/src/test/kotlin/**/*Tests.kt',
];

export const gradleConfigGlob = combineGlobPatterns(
  ...Array.from(GRADLE_BUILD_FILES).map((file) => `**/${file}`)
);

export const gradleConfigAndTestGlob = combineGlobPatterns(
  ...Array.from(GRADLE_BUILD_FILES).map((file) => `**/${file}`),
  ...Array.from(GRALDEW_FILES).map((file) => `**/${file}`),
  ...GRADLE_TEST_FILES
);

/**
 * This function split config files into build files, settings files, test files and project roots
 * @param files list of files to split
 * @returns object with buildFiles, gradlewFiles, testFiles and projectRoots
 * For gradlewFiles, it will start with settings files and find the nearest gradlew file in the workspace
 */
export function splitConfigFiles(files: readonly string[]): {
  buildFiles: string[];
  gradlewFiles: string[];
  testFiles: string[];
  projectRoots: string[];
} {
  const buildFiles = [];
  const testFiles = [];
  const gradlewFiles = [];
  const projectRoots = new Set<string>();

  files.forEach((file) => {
    const filename = basename(file);
    const fileDirectory = dirname(file);
    if (GRADLE_BUILD_FILES.has(filename)) {
      buildFiles.push(file);
      projectRoots.add(fileDirectory);
    } else if (GRALDEW_FILES.has(filename)) {
      if (process.platform.startsWith('win')) {
        if (filename === 'gradlew.bat') {
          gradlewFiles.push(file);
        }
      } else {
        if (filename === 'gradlew') {
          gradlewFiles.push(file);
        }
      }
    } else {
      testFiles.push(file);
    }
  });

  return {
    buildFiles,
    testFiles,
    gradlewFiles,
    projectRoots: Array.from(projectRoots),
  };
}
