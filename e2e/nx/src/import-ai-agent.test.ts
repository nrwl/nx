import {
  checkFilesExist,
  cleanupProject,
  getSelectedPackageManager,
  newProject,
  runCLI,
  runCommand,
  e2eCwd,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { rmdirSync } from 'fs';
import { join } from 'path';
import {
  createSimpleRepo,
  createMultiPackageRepo,
  parseNdjsonOutput,
  findMessage,
} from './import-utils';

const agentEnv = { CLAUDECODE: '1' };

describe('Nx Import - AI Agent Mode', () => {
  let proj: string;
  const tempImportE2ERoot = join(e2eCwd, 'nx-import-ai');

  beforeAll(() => {
    proj = newProject({
      packages: ['@nx/js'],
    });

    if (getSelectedPackageManager() === 'pnpm') {
      updateFile('pnpm-workspace.yaml', `packages:\n  - 'projects/*'\n`);
    } else {
      updateJson('package.json', (json) => {
        json.workspaces = ['projects/*'];
        return json;
      });
    }

    try {
      rmdirSync(tempImportE2ERoot);
    } catch {}
  });

  beforeEach(() => {
    runCommand(`git add .`);
    runCommand(`git commit -am "Update" --allow-empty`);
  });

  afterAll(() => cleanupProject());

  describe('needs_input for missing arguments', () => {
    it('should return needs_input when destination is missing', () => {
      const repoPath = createSimpleRepo(tempImportE2ERoot, 'needs-input-test');
      const output = runCLI(`import ${repoPath} --ref main`, {
        silenceError: true,
        env: agentEnv,
      });
      const messages = parseNdjsonOutput(output);
      const needsInput = findMessage(
        messages,
        (m) => m.stage === 'needs_input' && m.inputType === 'import_options'
      );
      expect(needsInput).toBeDefined();
      expect(needsInput.missingFields).toContain('destination');
      expect(needsInput.availableOptions).toHaveProperty('sourceRepository');
      expect(needsInput.availableOptions).toHaveProperty('ref');
      expect(needsInput.availableOptions).toHaveProperty('source');
      expect(needsInput.availableOptions).toHaveProperty('destination');
      expect(needsInput.availableOptions.source.required).toBe(false);
    });

    it('should return needs_input when multiple fields are missing', () => {
      const output = runCLI(`import https://github.com/test/repo`, {
        silenceError: true,
        env: agentEnv,
      });
      const messages = parseNdjsonOutput(output);
      const needsInput = findMessage(
        messages,
        (m) => m.stage === 'needs_input' && m.inputType === 'import_options'
      );
      expect(needsInput).toBeDefined();
      expect(needsInput.missingFields).toContain('ref');
      expect(needsInput.missingFields).toContain('destination');
    });
  });

  describe('full import with agent mode', () => {
    it('should complete successfully with --plugins=skip', () => {
      const repoPath = createSimpleRepo(tempImportE2ERoot, 'plugins-skip-test');
      const output = runCLI(
        `import ${repoPath} projects/skip-test --ref main --source . --plugins skip`,
        { verbose: true, env: agentEnv }
      );
      const messages = parseNdjsonOutput(output);

      expect(
        findMessage(messages, (m) => m.stage === 'starting')
      ).toBeDefined();
      expect(findMessage(messages, (m) => m.stage === 'cloning')).toBeDefined();
      expect(
        findMessage(messages, (m) => m.stage === 'complete')
      ).toBeDefined();

      const success = findMessage(
        messages,
        (m) => m.stage === 'complete' && m.success === true
      );
      expect(success).toBeDefined();
      expect(success.result.pluginsInstalled).toEqual([]);
      expect(success.result.destination).toBe('projects/skip-test');

      checkFilesExist(
        'projects/skip-test/README.md',
        'projects/skip-test/package.json'
      );
    });
  });

  describe('import subdirectory', () => {
    it('should import a subdirectory with correct paths in output', () => {
      const repoPath = createMultiPackageRepo(tempImportE2ERoot);
      const output = runCLI(
        `import ${repoPath} projects/pkg-a --ref main --source packages/a --plugins skip`,
        { verbose: true, env: agentEnv }
      );
      const messages = parseNdjsonOutput(output);
      const success = findMessage(
        messages,
        (m) => m.stage === 'complete' && m.success === true
      );
      expect(success).toBeDefined();
      expect(success.result.source).toBe('packages/a');
      expect(success.result.destination).toBe('projects/pkg-a');

      checkFilesExist('projects/pkg-a/README.md');
    });
  });

  describe('error cases', () => {
    it('should return structured error for non-empty destination', () => {
      const repoPath = createSimpleRepo(
        tempImportE2ERoot,
        'error-nonempty-test'
      );

      runCLI(
        `import ${repoPath} projects/error-dest --ref main --source . --plugins skip`,
        { verbose: true, env: agentEnv }
      );
      runCommand(`git add . && git commit -am "first import"`);

      const output = runCLI(
        `import ${repoPath} projects/error-dest --ref main --source . --plugins skip`,
        { silenceError: true, env: agentEnv }
      );
      const messages = parseNdjsonOutput(output);
      const error = findMessage(messages, (m) => m.stage === 'error');
      expect(error).toBeDefined();
      expect(error.errorCode).toBe('DESTINATION_NOT_EMPTY');
      expect(error.hints.length).toBeGreaterThan(0);
    });
  });
});
