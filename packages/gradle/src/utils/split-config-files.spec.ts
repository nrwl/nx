import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { splitConfigFiles } from './split-config-files';

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
    const { buildFiles, gradlewFiles, testFiles, projectRoots } =
      splitConfigFiles([
        'proj/build.gradle',
        'gradlew',
        'nested/nested/proj/build.gradle',
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
    const { buildFiles, gradlewFiles, testFiles, projectRoots } =
      splitConfigFiles([
        'proj/build.gradle',
        'proj/gradlew',
        'nested/nested/proj/build.gradle',
        'nested/nested/proj/gradlew',
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
    expect(projectRoots).toEqual(['proj', 'nested/nested/proj']);
  });
});
