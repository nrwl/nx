import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { splitConfigFiles, isGradleBuildFile } from './split-config-files';

describe('split config files', () => {
  let tempFs: TempFs;
  let cwd: string;

  beforeEach(async () => {
    tempFs = new TempFs('test');
    cwd = process.cwd();
    process.chdir(tempFs.tempDir);
  });

  afterEach(() => {
    jest.resetModules();
    process.chdir(cwd);
  });

  it('should split config files with one gradlew file', async () => {
    await tempFs.createFiles({
      'proj/build.gradle': ``,
      gradlew: '',
      'nested/nested/proj/build.gradle': ``,
      'nested/nested/proj/settings.gradle': ``,
      'nested/nested/proj/src/test/java/test/rootTest.java': ``,
      'nested/nested/proj/src/test/java/test/aTest.java': ``,
      'nested/nested/proj/src/test/java/test/bTest.java': ``,
    });
    const { buildFiles, gradlewFiles, testFiles, projectRoots, settingsFiles } =
      splitConfigFiles([
        'proj/build.gradle',
        'gradlew',
        'nested/nested/proj/build.gradle',
        'nested/nested/proj/settings.gradle',
        'nested/nested/proj/src/test/java/test/rootTest.java',
        'nested/nested/proj/src/test/java/test/aTest.java',
        'nested/nested/proj/src/test/java/test/bTest.java',
      ]);
    expect(buildFiles).toEqual([
      'proj/build.gradle',
      'nested/nested/proj/build.gradle',
    ]);
    expect(gradlewFiles).toEqual(['gradlew']);
    expect(testFiles).toEqual([
      'nested/nested/proj/src/test/java/test/rootTest.java',
      'nested/nested/proj/src/test/java/test/aTest.java',
      'nested/nested/proj/src/test/java/test/bTest.java',
    ]);
    expect(settingsFiles).toEqual(['nested/nested/proj/settings.gradle']);
    expect(projectRoots).toEqual(['proj', 'nested/nested/proj']);
  });

  it('should split config files with multiple gradlew files', async () => {
    await tempFs.createFiles({
      'proj/build.gradle': ``,
      'proj/gradlew': '',
      'proj/settings.gradle': ``,
      'nested/nested/proj/gradlew': '',
      'nested/nested/proj/build.gradle': ``,
      'nested/nested/proj/settings.gradle': ``,
      'nested/nested/proj/src/test/java/test/rootTest.java': ``,
      'nested/nested/proj/src/test/java/test/aTest.java': ``,
      'nested/nested/proj/src/test/java/test/bTest.java': ``,
    });
    const { buildFiles, gradlewFiles, testFiles, projectRoots, settingsFiles } =
      splitConfigFiles([
        'proj/build.gradle',
        'proj/gradlew',
        'proj/settings.gradle',
        'nested/nested/proj/build.gradle',
        'nested/nested/proj/gradlew',
        'nested/nested/proj/settings.gradle',
        'nested/nested/proj/src/test/java/test/rootTest.java',
        'nested/nested/proj/src/test/java/test/aTest.java',
        'nested/nested/proj/src/test/java/test/bTest.java',
      ]);
    expect(buildFiles).toEqual([
      'proj/build.gradle',
      'nested/nested/proj/build.gradle',
    ]);
    expect(gradlewFiles).toEqual([
      'proj/gradlew',
      'nested/nested/proj/gradlew',
    ]);
    expect(testFiles).toEqual([
      'nested/nested/proj/src/test/java/test/rootTest.java',
      'nested/nested/proj/src/test/java/test/aTest.java',
      'nested/nested/proj/src/test/java/test/bTest.java',
    ]);
    expect(settingsFiles).toEqual([
      'proj/settings.gradle',
      'nested/nested/proj/settings.gradle',
    ]);
    expect(projectRoots).toEqual(['proj', 'nested/nested/proj']);
  });

  it('should split config files with gradlew.bat on windows', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    await tempFs.createFiles({
      'proj/build.gradle': ``,
      'gradlew.bat': '',
      'nested/nested/proj/build.gradle': ``,
      'nested/nested/proj/settings.gradle': ``,
      'nested/nested/proj/src/test/java/test/rootTest.java': ``,
    });

    const { buildFiles, gradlewFiles, testFiles, projectRoots, settingsFiles } =
      splitConfigFiles([
        'proj/build.gradle',
        'gradlew.bat',
        'nested/nested/proj/build.gradle',
        'nested/nested/proj/settings.gradle',
        'nested/nested/proj/src/test/java/test/rootTest.java',
      ]);

    expect(buildFiles).toEqual([
      'proj/build.gradle',
      'nested/nested/proj/build.gradle',
    ]);
    expect(gradlewFiles).toEqual(['gradlew.bat']);
    expect(testFiles).toEqual([
      'nested/nested/proj/src/test/java/test/rootTest.java',
    ]);
    expect(settingsFiles).toEqual(['nested/nested/proj/settings.gradle']);
    expect(projectRoots).toEqual(['proj', 'nested/nested/proj']);

    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    });
  });

  it('should correctly categorize custom gradle files', async () => {
    await tempFs.createFiles({
      'spring-websocket/spring-websocket.gradle': ``,
    });

    const { buildFiles, gradlewFiles, testFiles, projectRoots, settingsFiles } =
      splitConfigFiles(['spring-websocket/spring-websocket.gradle']);

    expect(buildFiles).toEqual(['spring-websocket/spring-websocket.gradle']);
    expect(gradlewFiles).toEqual([]);
    expect(testFiles).toEqual([]);
    expect(settingsFiles).toEqual([]);
    expect(projectRoots).toEqual(['spring-websocket']);
  });

  it('should ignore settings.gradle files', async () => {
    await tempFs.createFiles({
      'my-app/settings.gradle': ``,
    });

    const { buildFiles, gradlewFiles, testFiles, projectRoots, settingsFiles } =
      splitConfigFiles(['my-app/settings.gradle']);

    expect(buildFiles).toEqual([]);
    expect(gradlewFiles).toEqual([]);
    expect(testFiles).toEqual([]);
    expect(projectRoots).toEqual([]);
    expect(settingsFiles).toEqual(['my-app/settings.gradle']);
  });
});

describe('isGradleBuildFile', () => {
  it('should return true for .gradle files', () => {
    expect(isGradleBuildFile('build.gradle')).toBe(true);
  });

  it('should return true for .gradle.kts files', () => {
    expect(isGradleBuildFile('build.gradle.kts')).toBe(true);
  });

  it('should return false for settings.gradle files', () => {
    expect(isGradleBuildFile('settings.gradle')).toBe(false);
  });

  it('should return false for settings.gradle.kts files', () => {
    expect(isGradleBuildFile('settings.gradle.kts')).toBe(false);
  });

  it('should return false for other files', () => {
    expect(isGradleBuildFile('some-file.txt')).toBe(false);
    expect(isGradleBuildFile('gradlew')).toBe(false);
    expect(isGradleBuildFile('gradlew.bat')).toBe(false);
  });
});
