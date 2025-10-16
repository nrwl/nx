import { runMavenAnalysis } from './maven-analyzer';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { readJsonFile } from '@nx/devkit';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { EventEmitter } from 'events';

jest.mock('child_process');
jest.mock('fs');
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
  });

  describe('runMavenAnalysis', () => {
    it('should run Maven analysis with default options', async () => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.pid = 1234;

      (spawn as jest.Mock).mockReturnValue(mockChild);
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

      expect(spawn).toHaveBeenCalledWith(
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

      (spawn as jest.Mock).mockReturnValue(mockChild);
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
      expect(spawn).toHaveBeenCalledWith(
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

      (spawn as jest.Mock).mockReturnValue(mockChild);
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

      expect(spawn).toHaveBeenCalledWith(
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

      (spawn as jest.Mock).mockReturnValue(mockChild);
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

      expect(spawn).toHaveBeenCalledWith(
        'mvnw.cmd',
        expect.any(Array),
        expect.any(Object)
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should fallback to mvn when wrapper is not available', async () => {
      (existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('nx-maven-projects.json');
      });

      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.pid = 1234;

      (spawn as jest.Mock).mockReturnValue(mockChild);
      (readJsonFile as jest.Mock).mockReturnValue({
        projects: [],
        generatedAt: Date.now(),
      });

      const promise = runMavenAnalysis(workspaceRoot, {});

      setImmediate(() => {
        mockChild.emit('close', 0);
      });

      await promise;

      expect(spawn).toHaveBeenCalledWith(
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

      (spawn as jest.Mock).mockReturnValue(mockChild);

      const promise = runMavenAnalysis(workspaceRoot, {});

      setImmediate(() => {
        mockChild.stderr.emit('data', Buffer.from('Maven error occurred'));
        mockChild.emit('close', 1);
      });

      await expect(promise).rejects.toThrow(
        'Maven analysis failed with code 1'
      );
    });

    it('should handle spawn error', async () => {
      const mockChild = new EventEmitter() as any;
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      mockChild.pid = 1234;

      (spawn as jest.Mock).mockReturnValue(mockChild);

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

      (spawn as jest.Mock).mockReturnValue(mockChild);
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

      (spawn as jest.Mock).mockReturnValue(mockChild);
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

      (spawn as jest.Mock).mockReturnValue(mockChild);
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
});
