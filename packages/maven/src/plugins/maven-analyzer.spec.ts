import { getAnalysisTimeoutMs, runMavenAnalysis } from './maven-analyzer';
import { existsSync } from 'fs';
import { readJsonFile } from '@nx/devkit';
import { EventEmitter } from 'events';
import {
  killChildOnHostExit,
  killProcessTreeGraceful,
  safeExecFileSync,
  safeSpawn,
  workspaceDataDirectory,
} from '@nx/devkit/internal';

jest.mock('fs');
// Mock the wrapper, not child_process: safeSpawn decides platform behavior at
// call time, and a child_process assertion would only hold off Windows.
jest.mock('@nx/devkit/internal', () => ({
  ...jest.requireActual('@nx/devkit/internal'),
  safeSpawn: jest.fn(),
  safeExecFileSync: jest.fn(),
  killProcessTreeGraceful: jest.fn().mockResolvedValue(undefined),
  killChildOnHostExit: jest.fn(),
}));
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  readJsonFile: jest.fn(),
}));

describe('Maven Analyzer', () => {
  const workspaceRoot = '/test/workspace';
  const mockOutputFile = `${workspaceDataDirectory}/nx-maven-projects.json`;

  beforeEach(() => {
    jest.clearAllMocks();
    (existsSync as jest.Mock).mockReturnValue(true);
    // Mock mvnd detection to fail by default, so tests use mvnw/mvn
    (safeExecFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('mvnd not found');
    });
  });

  describe('getAnalysisTimeoutMs', () => {
    afterEach(() => {
      delete process.env.NX_MAVEN_ANALYSIS_TIMEOUT;
    });

    // setTimeout clamps a delay past the 32-bit signed max to 1ms, so an
    // unclamped huge value would abort the analysis instantly — the opposite
    // of what the timeout error tells the user to do.
    it('should clamp an overflowing NX_MAVEN_ANALYSIS_TIMEOUT', () => {
      process.env.NX_MAVEN_ANALYSIS_TIMEOUT = '9999999';
      expect(getAnalysisTimeoutMs()).toBe(2 ** 31 - 1);

      process.env.NX_MAVEN_ANALYSIS_TIMEOUT = 'Infinity';
      expect(getAnalysisTimeoutMs()).toBe(2 ** 31 - 1);

      process.env.NX_MAVEN_ANALYSIS_TIMEOUT = '30';
      expect(getAnalysisTimeoutMs()).toBe(30_000);
    });
  });

  describe('runMavenAnalysis', () => {
    it('should register the maven process to be killed on host exit', async () => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.pid = 1234;

      (safeSpawn as jest.Mock).mockReturnValue(mockChild);
      (readJsonFile as jest.Mock).mockReturnValue({
        projects: [],
        generatedAt: 0,
      });

      const promise = runMavenAnalysis(workspaceRoot, {});
      setImmediate(() => {
        mockChild.emit('close', 0);
      });
      await promise;

      expect(killChildOnHostExit).toHaveBeenCalledWith(mockChild);
    });

    it('should run Maven analysis with default options', async () => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.pid = 1234;

      (safeSpawn as jest.Mock).mockReturnValue(mockChild);
      (readJsonFile as jest.Mock).mockReturnValue({
        projects: [],
        generatedAt: Date.now(),
      });

      const promise = runMavenAnalysis(workspaceRoot, {});

      // Simulate successful completion
      setImmediate(() => {
        mockChild.emit('close', 0);
      });

      await promise;

      expect(safeSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          'dev.nx.maven:nx-maven-plugin:analyze',
          '-am',
          expect.stringContaining('-DoutputFile='),
          expect.stringContaining('-DworkspaceRoot='),
          '--batch-mode',
          '--no-transfer-progress',
          '-q',
        ]),
        expect.objectContaining({
          cwd: workspaceRoot,
          stdio: 'pipe',
        })
      );
    });

    it('should run Maven analysis with verbose mode', async () => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.pid = 1234;

      (safeSpawn as jest.Mock).mockReturnValue(mockChild);
      (readJsonFile as jest.Mock).mockReturnValue({
        projects: [],
        generatedAt: Date.now(),
      });

      const promise = runMavenAnalysis(workspaceRoot, { verbose: true });

      // Simulate successful completion
      setImmediate(() => {
        mockChild.emit('close', 0);
      });

      await promise;

      // Should NOT include -q flag in verbose mode
      expect(safeSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.arrayContaining(['-q']),
        expect.any(Object)
      );
    });

    it('should use mvnw wrapper on Unix when available', async () => {
      (existsSync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('mvnw') && !path.includes('.cmd')) {
          return true;
        }
        return path.includes('nx-maven-projects.json');
      });

      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.pid = 1234;

      (safeSpawn as jest.Mock).mockReturnValue(mockChild);
      (readJsonFile as jest.Mock).mockReturnValue({
        projects: [],
        generatedAt: Date.now(),
      });

      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const promise = runMavenAnalysis(workspaceRoot, {});

      setImmediate(() => {
        mockChild.emit('close', 0);
      });

      await promise;

      expect(safeSpawn).toHaveBeenCalledWith(
        './mvnw',
        expect.any(Array),
        expect.any(Object)
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should use mvnw.cmd wrapper on Windows when available', async () => {
      (existsSync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('mvnw.cmd')) {
          return true;
        }
        return path.includes('nx-maven-projects.json');
      });

      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.pid = 1234;

      (safeSpawn as jest.Mock).mockReturnValue(mockChild);
      (readJsonFile as jest.Mock).mockReturnValue({
        projects: [],
        generatedAt: Date.now(),
      });

      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const promise = runMavenAnalysis(workspaceRoot, {});

      setImmediate(() => {
        mockChild.emit('close', 0);
      });

      await promise;

      Object.defineProperty(process, 'platform', { value: originalPlatform });

      const [binary, , options] = (safeSpawn as jest.Mock).mock.calls[0];
      expect(binary).toBe('mvnw.cmd');
      expect(options.shell).toBeFalsy();
    });

    it('should fallback to mvn when wrapper is not available', async () => {
      (existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('nx-maven-projects.json');
      });

      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.pid = 1234;

      (safeSpawn as jest.Mock).mockReturnValue(mockChild);
      (readJsonFile as jest.Mock).mockReturnValue({
        projects: [],
        generatedAt: Date.now(),
      });

      const promise = runMavenAnalysis(workspaceRoot, {});

      setImmediate(() => {
        mockChild.emit('close', 0);
      });

      await promise;

      expect(safeSpawn).toHaveBeenCalledWith(
        'mvn',
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('should handle Maven process failure', async () => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.pid = 1234;

      (safeSpawn as jest.Mock).mockReturnValue(mockChild);

      const promise = runMavenAnalysis(workspaceRoot, {});

      setImmediate(() => {
        mockChild.stderr.emit('data', Buffer.from('Maven error occurred'));
        mockChild.emit('close', 1);
      });

      await expect(promise).rejects.toThrow(
        'Maven analysis failed with code 1'
      );
    });

    // A process that never exits must still settle the promise, or the
    // timeout error is never reported.
    it('should report the timeout even if the process never exits', async () => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.pid = 1234;
      (safeSpawn as jest.Mock).mockReturnValue(mockChild);

      process.env.NX_MAVEN_ANALYSIS_TIMEOUT = '0.001';
      try {
        await expect(runMavenAnalysis(workspaceRoot, {})).rejects.toThrow(
          'Maven analysis timed out'
        );
        expect(killProcessTreeGraceful).toHaveBeenCalledWith(1234);
      } finally {
        delete process.env.NX_MAVEN_ANALYSIS_TIMEOUT;
      }
    });

    it('should handle spawn error', async () => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.pid = 1234;

      (safeSpawn as jest.Mock).mockReturnValue(mockChild);

      const promise = runMavenAnalysis(workspaceRoot, {});

      setImmediate(() => {
        mockChild.emit('error', new Error('Command not found'));
      });

      await expect(promise).rejects.toThrow(
        'Failed to spawn Maven process: Command not found'
      );
    });

    it('should handle missing output file', async () => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.pid = 1234;

      (safeSpawn as jest.Mock).mockReturnValue(mockChild);
      (existsSync as jest.Mock).mockReturnValue(false);

      const promise = runMavenAnalysis(workspaceRoot, {});

      setImmediate(() => {
        mockChild.emit('close', 0);
      });

      await expect(promise).rejects.toThrow(
        'Maven analysis output file not found'
      );
    });

    it('should forward output in verbose mode', async () => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.pid = 1234;

      const stdoutSpy = jest
        .spyOn(process.stdout, 'write')
        .mockImplementation();
      const stderrSpy = jest
        .spyOn(process.stderr, 'write')
        .mockImplementation();

      (safeSpawn as jest.Mock).mockReturnValue(mockChild);
      (readJsonFile as jest.Mock).mockReturnValue({
        projects: [],
        generatedAt: Date.now(),
      });

      const promise = runMavenAnalysis(workspaceRoot, { verbose: true });

      setImmediate(() => {
        mockChild.stdout.emit('data', Buffer.from('Maven output'));
        mockChild.stderr.emit('data', Buffer.from('Maven stderr'));
        mockChild.emit('close', 0);
      });

      await promise;

      expect(stdoutSpy).toHaveBeenCalledWith('Maven output');
      expect(stderrSpy).toHaveBeenCalledWith('Maven stderr');

      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    });

    it('should return parsed JSON result', async () => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.pid = 1234;

      const mockResult = {
        projects: [
          {
            artifactId: 'test-project',
            groupId: 'com.example',
            version: '1.0.0',
          },
        ],
        generatedAt: Date.now(),
      };

      (safeSpawn as jest.Mock).mockReturnValue(mockChild);
      (readJsonFile as jest.Mock).mockReturnValue(mockResult);

      const promise = runMavenAnalysis(workspaceRoot, {});

      setImmediate(() => {
        mockChild.emit('close', 0);
      });

      const result = await promise;

      expect(result).toEqual(mockResult);
      expect(readJsonFile).toHaveBeenCalledWith(
        expect.stringContaining('nx-maven-projects.json')
      );
    });
  });

  describe('command injection (NXC-4659)', () => {
    it('should pass targetNamePrefix as a literal argument, never through a shell', async () => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.pid = 1234;

      (safeSpawn as jest.Mock).mockReturnValue(mockChild);
      (readJsonFile as jest.Mock).mockReturnValue({
        projects: [],
        generatedAt: Date.now(),
      });

      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const malicious = 'x; touch /tmp/pwned';
      const promise = runMavenAnalysis(workspaceRoot, {
        targetNamePrefix: malicious,
      });
      setImmediate(() => mockChild.emit('close', 0));
      await promise;

      Object.defineProperty(process, 'platform', { value: originalPlatform });

      const [, args, options] = (safeSpawn as jest.Mock).mock.calls[0];
      expect(options.shell).toBeFalsy();
      expect(args).toContain(`-DtargetNamePrefix=${malicious}`);
    });
  });
});
