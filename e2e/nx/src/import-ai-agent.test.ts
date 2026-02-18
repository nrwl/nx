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
import { writeFileSync, mkdirSync, rmdirSync } from 'fs';
import { execSync } from 'node:child_process';
import { join } from 'path';

/**
 * Parse NDJSON output from agent-mode nx commands.
 * Splits stdout on newlines, parses each JSON line,
 * filters out USER_NEXT_STEPS plain text section.
 */
function parseNdjsonOutput(stdout: string): Record<string, any>[] {
  return stdout
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      // Skip the USER_NEXT_STEPS plain text section
      if (trimmed.startsWith('---') || trimmed.startsWith('[DISPLAY]'))
        return false;
      // Only try to parse lines starting with {
      if (!trimmed.startsWith('{')) return false;
      return true;
    })
    .map((line) => {
      try {
        return JSON.parse(line.trim());
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function findMessage(
  messages: Record<string, any>[],
  predicate: (msg: Record<string, any>) => boolean
): Record<string, any> | undefined {
  return messages.find(predicate);
}

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

  /**
   * Helper: create a simple git repo with a README
   */
  function createSimpleRepo(name: string): string {
    const repoPath = join(tempImportE2ERoot, name);
    mkdirSync(repoPath, { recursive: true });
    writeFileSync(join(repoPath, 'README.md'), `# ${name}`);
    writeFileSync(
      join(repoPath, 'package.json'),
      JSON.stringify({ name, version: '1.0.0' }, null, 2)
    );
    execSync(`git init && git add . && git commit -m "initial commit"`, {
      cwd: repoPath,
    });
    try {
      execSync(`git checkout -b main`, { cwd: repoPath });
    } catch {}
    return repoPath;
  }

  /**
   * Helper: create a repo with two packages
   */
  function createMultiPackageRepo(): string {
    const repoPath = join(tempImportE2ERoot, 'multi-pkg');
    mkdirSync(repoPath, { recursive: true });
    writeFileSync(join(repoPath, 'README.md'), '# Repo');
    execSync(`git init && git add . && git commit -m "initial"`, {
      cwd: repoPath,
    });
    try {
      execSync(`git checkout -b main`, { cwd: repoPath });
    } catch {}

    mkdirSync(join(repoPath, 'packages/a'), { recursive: true });
    writeFileSync(join(repoPath, 'packages/a/README.md'), '# A');
    writeFileSync(
      join(repoPath, 'packages/a/package.json'),
      JSON.stringify({ name: 'pkg-a', version: '1.0.0' }, null, 2)
    );
    execSync(`git add . && git commit -m "add package a"`, { cwd: repoPath });

    mkdirSync(join(repoPath, 'packages/b'), { recursive: true });
    writeFileSync(join(repoPath, 'packages/b/README.md'), '# B');
    writeFileSync(
      join(repoPath, 'packages/b/package.json'),
      JSON.stringify({ name: 'pkg-b', version: '1.0.0' }, null, 2)
    );
    execSync(`git add . && git commit -m "add package b"`, { cwd: repoPath });

    return repoPath;
  }

  describe('needs_input for missing arguments', () => {
    it('should return needs_input when destination is missing', () => {
      const repoPath = createSimpleRepo('needs-input-test');
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
      const repoPath = createSimpleRepo('plugins-skip-test');
      const output = runCLI(
        `import ${repoPath} projects/skip-test --ref main --source . --plugins skip`,
        { verbose: true, env: agentEnv }
      );
      const messages = parseNdjsonOutput(output);

      // Check progress stages
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
      const repoPath = createMultiPackageRepo();
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
      const repoPath = createSimpleRepo('error-nonempty-test');

      // First import to populate destination
      runCLI(
        `import ${repoPath} projects/error-dest --ref main --source . --plugins skip`,
        { verbose: true, env: agentEnv }
      );
      runCommand(`git add . && git commit -am "first import"`);

      // Second import to same destination should fail
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
