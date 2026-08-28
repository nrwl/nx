import {
  findGradlewFile,
  getCustomGradleExecutableDirectoryFromPlugin,
} from './exec-gradle';
import { NxJsonConfiguration } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';

describe('exec gradle', () => {
  describe('findGradlewFile', () => {
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

    it('should find gradlew with one gradlew file at root', async () => {
      await tempFs.createFiles({
        'proj/build.gradle': ``,
        gradlew: '',
        'nested/nested/proj/build.gradle': ``,
        'nested/nested/proj/settings.gradle': ``,
        'nested/nested/proj/src/test/java/test/rootTest.java': ``,
        'nested/nested/proj/src/test/java/test/aTest.java': ``,
        'nested/nested/proj/src/test/java/test/bTest.java': ``,
      });
      let gradlewFile = findGradlewFile('proj/build.gradle', tempFs.tempDir);
      expect(gradlewFile).toEqual('gradlew');
      gradlewFile = findGradlewFile(
        'nested/nested/proj/build.gradle',
        tempFs.tempDir
      );
      expect(gradlewFile).toEqual('gradlew');
      gradlewFile = findGradlewFile(
        'nested/nested/proj/settings.gradle',
        tempFs.tempDir
      );
      expect(gradlewFile).toEqual('gradlew');
    });

    it('should find gradlew with multiple gradlew files with nested project structure', async () => {
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

      let gradlewFile = findGradlewFile('proj/build.gradle', tempFs.tempDir);
      expect(gradlewFile).toEqual('proj/gradlew');
      gradlewFile = findGradlewFile('proj/settings.gradle', tempFs.tempDir);
      expect(gradlewFile).toEqual('proj/gradlew');
      gradlewFile = findGradlewFile(
        'nested/nested/proj/build.gradle',
        tempFs.tempDir
      );
      expect(gradlewFile).toEqual('nested/nested/proj/gradlew');
      gradlewFile = findGradlewFile(
        'nested/nested/proj/settings.gradle',
        tempFs.tempDir
      );
      expect(gradlewFile).toEqual('nested/nested/proj/gradlew');
    });

    it('should throw an error if no gradlew in workspace', async () => {
      await tempFs.createFiles({
        'proj/build.gradle': ``,
        'nested/nested/proj/build.gradle': ``,
        'nested/nested/proj/settings.gradle': ``,
        'nested/nested/proj/src/test/java/test/rootTest.java': ``,
        'nested/nested/proj/src/test/java/test/aTest.java': ``,
        'nested/nested/proj/src/test/java/test/bTest.java': ``,
      });
      expect(() =>
        findGradlewFile('proj/build.gradle', tempFs.tempDir)
      ).toThrow();
    });
  });

  describe('getCustomGradleExecutableDirectoryPathFromPlugin', () => {
    it('should return undefined when nxJson plugins is empty array', () => {
      const nxJson: NxJsonConfiguration = {
        plugins: [],
      };
      const result = getCustomGradleExecutableDirectoryFromPlugin(nxJson);
      expect(result).toBeUndefined();
    });

    it('should return undefined when gradle plugin is not in plugins list', () => {
      const nxJson: NxJsonConfiguration = {
        plugins: ['@nx/js', '@nx/react'],
      };
      const result = getCustomGradleExecutableDirectoryFromPlugin(nxJson);
      expect(result).toBeUndefined();
    });

    it('should return undefined when gradle plugin is specified as string', () => {
      const nxJson: NxJsonConfiguration = {
        plugins: ['@nx/gradle'],
      };
      const result = getCustomGradleExecutableDirectoryFromPlugin(nxJson);
      expect(result).toBeUndefined();
    });

    it('should return undefined when gradle plugin has no gradleExecutableDirectory option', () => {
      const nxJson: NxJsonConfiguration = {
        plugins: [
          {
            plugin: '@nx/gradle',
            options: {},
          },
        ],
      };
      const result = getCustomGradleExecutableDirectoryFromPlugin(nxJson);
      expect(result).toBeUndefined();
    });

    it('should return gradleExecutableDirectory from gradle plugin when multiple plugins exist', () => {
      const nxJson: NxJsonConfiguration = {
        plugins: [
          '@nx/js',
          {
            plugin: '@nx/gradle',
            options: {
              gradleExecutableDirectory: '/path/to/gradle',
            },
          },
          '@nx/react',
        ],
      };
      const result = getCustomGradleExecutableDirectoryFromPlugin(nxJson);
      expect(result).toBe('/path/to/gradle');
    });
  });
});

describe('execGradleAsync', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  function loadWithMockedSpawn() {
    let captured: any;
    jest.doMock('@nx/devkit/internal', () => ({
      ...jest.requireActual('@nx/devkit/internal'),
      killChildOnHostExit: jest.fn(),
      safeSpawn: jest.fn((binary, args, options) => {
        captured = { binary, args, options };
        const EventEmitter = require('events');
        const cp: any = new EventEmitter();
        cp.stdout = new EventEmitter();
        cp.stderr = new EventEmitter();
        setImmediate(() => cp.emit('exit', 0, null));
        return cp;
      }),
    }));
    const { execGradleAsync } = require('./exec-gradle');
    return { execGradleAsync, getCaptured: () => captured };
  }

  // NXC-4659: gradle plugin options are interpolated into `-Pkey=value`, so a
  // shell here would make nx.json command-injectable.
  it('should pass args literally without a shell', async () => {
    const { execGradleAsync, getCaptured } = loadWithMockedSpawn();
    const malicious = '-PtargetNamePrefix=x; touch /tmp/pwned';

    await execGradleAsync('/ws/gradlew', ['nxProjectGraph', malicious]);

    const captured = getCaptured();
    expect(captured.options.shell).toBeUndefined();
    expect(captured.args).toEqual(['nxProjectGraph', malicious]);
  });

  // Without a shell the child is gradlew itself, so spawn can fail outright and
  // Node emits `error` instead of `exit`.
  it('should reject when the spawn itself fails', async () => {
    let captured: any;
    jest.doMock('@nx/devkit/internal', () => ({
      ...jest.requireActual('@nx/devkit/internal'),
      killChildOnHostExit: jest.fn(),
      safeSpawn: jest.fn(() => {
        const EventEmitter = require('events');
        const cp: any = new EventEmitter();
        cp.stdout = new EventEmitter();
        cp.stderr = new EventEmitter();
        setImmediate(() => cp.emit('error', new Error('spawn EACCES')));
        return cp;
      }),
    }));
    const { execGradleAsync } = require('./exec-gradle');

    await expect(
      execGradleAsync('/ws/gradlew', ['nxProjectGraph'])
    ).rejects.toThrow('spawn EACCES');
  });

  // A wedged JVM can survive the kill signal; the promise must still settle
  // on abort or the timeout error never surfaces.
  it('should reject on abort even if the process never exits', async () => {
    const killProcessTreeGraceful = jest.fn(() => Promise.resolve());
    jest.doMock('@nx/devkit/internal', () => ({
      ...jest.requireActual('@nx/devkit/internal'),
      killChildOnHostExit: jest.fn(),
      safeSpawn: jest.fn(() => {
        const EventEmitter = require('events');
        const cp: any = new EventEmitter();
        cp.pid = 123;
        cp.stdout = new EventEmitter();
        cp.stderr = new EventEmitter();
        return cp; // never emits `exit`
      }),
      killProcessTreeGraceful,
    }));
    const { execGradleAsync } = require('./exec-gradle');

    const controller = new AbortController();
    const promise = execGradleAsync('/ws/gradlew', ['nxProjectGraph'], {
      signal: controller.signal,
    });
    controller.abort();

    await expect(promise).rejects.toBeDefined();
    expect(killProcessTreeGraceful).toHaveBeenCalledWith(123);
  });

  it('should register the gradle process to be killed on host exit', async () => {
    const killChildOnHostExit = jest.fn();
    let spawned: any;
    jest.doMock('@nx/devkit/internal', () => ({
      ...jest.requireActual('@nx/devkit/internal'),
      safeSpawn: jest.fn(() => {
        const EventEmitter = require('events');
        spawned = new EventEmitter();
        spawned.pid = 456;
        spawned.stdout = new EventEmitter();
        spawned.stderr = new EventEmitter();
        setImmediate(() => spawned.emit('exit', 0, null));
        return spawned;
      }),
      killChildOnHostExit,
    }));
    const { execGradleAsync } = require('./exec-gradle');

    await execGradleAsync('/ws/gradlew', ['nxProjectGraph']);

    expect(killChildOnHostExit).toHaveBeenCalledWith(spawned);
  });

  it('should drop empty args the shell used to swallow', async () => {
    const { execGradleAsync, getCaptured } = loadWithMockedSpawn();

    await execGradleAsync('/ws/gradlew', ['nxProjectGraph', '']);

    expect(getCaptured().args).toEqual(['nxProjectGraph']);
  });
});
