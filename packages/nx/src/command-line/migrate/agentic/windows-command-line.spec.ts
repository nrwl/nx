// Partial mock: transitive imports promisify other `child_process` exports at
// module load, so the real module has to supply everything this does not stub.
vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('child_process')>()),
  spawn: vi.fn(),
  execSync: vi.fn(),
}));

import { mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { basename, dirname, join } from 'path';
import type { FileChange } from '../../../generators/tree';
import {
  claudeCodeDefinition,
  codexDefinition,
  opencodeDefinition,
} from './definitions';
import { stepHandoffPath } from './handoff';
import { writeStepInstructionFiles } from './instruction-files';
import { buildGenericValidationUserPrompt } from './prompts/generic-validation';
import { buildHybridPromptUserPrompt } from './prompts/hybrid-prompt-migration';
import { buildPromptMigrationUserPrompt } from './prompts/prompt-migration';
import {
  AgenticPromptMode,
  buildInlineSystemContext,
  buildMinimalSystemContext,
  buildSystemPrompt,
} from './prompts/system-prompt';
import {
  adaptSpawnForWindowsShim,
  WINDOWS_COMMAND_LINE_BUDGET,
} from './runner';
import { AgentDefinition, InvocationContext } from './types';

/**
 * cmd.exe runs a command line of at most 8191 characters, and nx reaches
 * npm-installed agents on Windows through a `.cmd` shim. This suite drives the
 * real prompt builders, the real `buildInteractive` of each agent and the real
 * Windows adapter, so any change putting prompt-sized content back on the
 * command line fails here.
 *
 * The workspace root is a real (POSIX) temporary directory because the files
 * are written; it is padded to Windows' 260-character MAX_PATH.
 */
describe('windows command line', () => {
  const originalPlatform = process.platform;
  let base: string;
  let workspaceRoot: string;
  let braceWorkspaceRoot: string;

  // Long enough that its own contribution to every path is visible.
  const migration = {
    package: `@nx/${'a'.repeat(60)}`,
    name: `update-23-1-0-${'b'.repeat(80)}`,
    version: '23.1.0',
    description: 'a'.repeat(200),
  };

  const emptyImpl = {
    logs: '',
    changes: [] as FileChange[],
    agentContext: [] as string[],
    hasDiffContext: false,
  };
  const largeImpl = {
    logs: Array.from(
      { length: 500 },
      (_, i) => `UPDATE apps/application-${i}/project.json`
    ).join('\n'),
    changes: Array.from(
      { length: 100 },
      (_, i) =>
        ({
          type: 'UPDATE',
          path: `apps/application-${i}/src/app/app.component.ts`,
          content: null,
        }) as FileChange
    ),
    agentContext: Array.from(
      { length: 20 },
      (_, i) => `Advisory note number ${i} from the generator.`
    ),
    hasDiffContext: false,
  };

  const agents: ReadonlyArray<[string, AgentDefinition, string]> = [
    [
      'claude-code',
      claudeCodeDefinition,
      'C:\\Users\\developer\\AppData\\Roaming\\npm\\claude.cmd',
    ],
    [
      'codex',
      codexDefinition,
      'C:\\Users\\developer\\AppData\\Roaming\\npm\\codex.cmd',
    ],
    [
      'opencode',
      opencodeDefinition,
      'C:\\Users\\developer\\AppData\\Roaming\\npm\\opencode.cmd',
    ],
  ];
  const modes: readonly AgenticPromptMode[] = ['author', 'generic-validation'];

  beforeAll(() => {
    base = mkdtempSync(join(tmpdir(), 'nx-migrate-cmdline-'));
    workspaceRoot = join(base, 'w'.repeat(Math.max(1, 259 - base.length)));
    mkdirSync(workspaceRoot, { recursive: true });
    // Windows allows braces in a directory name and nothing sanitizes the
    // workspace root, so this is a path a user can really have.
    braceWorkspaceRoot = join(
      base,
      `{${'w'.repeat(Math.max(1, 257 - base.length))}}`
    );
    mkdirSync(braceWorkspaceRoot, { recursive: true });
  });

  afterAll(() => {
    rmSync(base, { recursive: true, force: true });
    Object.defineProperty(process, 'platform', {
      configurable: true,
      writable: true,
      value: originalPlatform,
    });
  });

  // A null `impl` selects the prompt-only builder, non-null the hybrid one.
  function buildSpawn(
    definition: AgentDefinition,
    shimBinary: string,
    mode: AgenticPromptMode,
    impl: typeof emptyImpl | null,
    root: string = workspaceRoot
  ) {
    const runDir = join(root, '.nx', 'migrate-runs', migration.version);
    const handoffFileAbsolutePath = stepHandoffPath(runDir, migration);
    mkdirSync(dirname(handoffFileAbsolutePath), { recursive: true });

    const systemPrompt = buildSystemPrompt({
      workspaceRoot: root,
      handoffFileAbsolutePath,
      packageManager: 'npm',
      nxInvocation: 'npx nx',
      mode,
    });
    const promptCtx = {
      ...migration,
      promptPath: `migrations/${migration.name}.md`,
      handoffFileAbsolutePath,
    };
    let instructions: string;
    if (mode === 'generic-validation') {
      instructions = buildGenericValidationUserPrompt({
        ...migration,
        handoffFileAbsolutePath,
        impl: impl!,
      });
    } else {
      instructions = impl
        ? buildHybridPromptUserPrompt({ ...promptCtx, impl })
        : buildPromptMigrationUserPrompt(promptCtx);
    }

    const files = writeStepInstructionFiles({
      workspaceRoot: root,
      runDir,
      migration,
      systemPrompt,
      instructions,
    });
    const invocationContext: InvocationContext = {
      systemPrompt,
      systemPromptFilePath: files.systemPromptFilePath,
      instructionsPointer: files.instructionsPointer,
      inlineSystemContext: buildInlineSystemContext({
        handoffFileAbsolutePath,
        systemPromptFilePath: files.systemPromptFilePath,
      }),
      inlineSystemContextFallback: buildMinimalSystemContext(
        files.systemPromptFilePath
      ),
      workspaceRoot: root,
      runDirName: basename(runDir),
    };

    const spec = definition.buildInteractive(invocationContext);
    setPlatform('win32');
    try {
      return {
        spec,
        adapted: adaptSpawnForWindowsShim(shimBinary, spec.args, {}),
      };
    } finally {
      setPlatform(originalPlatform);
    }
  }

  function setPlatform(value: NodeJS.Platform): void {
    Object.defineProperty(process, 'platform', {
      configurable: true,
      writable: true,
      value,
    });
  }

  it('pins the workspace root at Windows MAX_PATH', () => {
    expect(workspaceRoot.length).toBeGreaterThanOrEqual(260);
  });

  describe.each(agents)('%s', (_id, definition, shimBinary) => {
    describe.each(modes)('%s mode', (mode) => {
      it('stays within the command line budget with a large generator context', () => {
        const { adapted } = buildSpawn(definition, shimBinary, mode, largeImpl);
        expect(adapted.commandLineLength).toBeLessThanOrEqual(
          WINDOWS_COMMAND_LINE_BUDGET
        );
      });

      // The two are held against each other rather than against a number a
      // short workspace path would satisfy on its own.
      it('costs the same on the command line whatever the generator produced', () => {
        const empty = buildSpawn(definition, shimBinary, mode, emptyImpl);
        const large = buildSpawn(definition, shimBinary, mode, largeImpl);
        expect(large.adapted.commandLineLength).toBe(
          empty.adapted.commandLineLength
        );
      });

      it('puts no line break on the command line', () => {
        const { spec } = buildSpawn(definition, shimBinary, mode, largeImpl);
        for (const arg of spec.args) {
          expect(arg).not.toMatch(/[\r\n]/);
        }
      });

      // cmd.exe drops any inherited environment variable longer than its own
      // 8191-character limit, so what moves off the command line cannot simply
      // move into the environment.
      it('keeps every environment value it sets well within the variable limit', () => {
        const { spec } = buildSpawn(definition, shimBinary, mode, largeImpl);
        for (const [name, value] of Object.entries(spec.env ?? {})) {
          expect(`${name}=${value}`.length).toBeLessThanOrEqual(1000);
        }
      });
    });

    // The matrix above only reaches the hybrid builder; a migration with no
    // generator output takes the third prompt shape.
    it('stays within the budget in author mode with no generator context', () => {
      const { spec, adapted } = buildSpawn(
        definition,
        shimBinary,
        'author',
        null
      );

      expect(adapted.commandLineLength).toBeLessThanOrEqual(
        WINDOWS_COMMAND_LINE_BUDGET
      );
      for (const arg of spec.args) {
        expect(arg).not.toMatch(/[\r\n]/);
      }
    });
  });

  // A `}` in the root defeats the `{file:<path>}` substitution and sends the
  // prompt through the environment, which the runner's command-line budget does
  // not measure; the bound there is cmd.exe's 8191-character limit per
  // inherited variable.
  it('keeps opencode under the environment variable limit when the workspace path defeats the file substitution', () => {
    const { spec } = buildSpawn(
      opencodeDefinition,
      'C:\\Users\\developer\\AppData\\Roaming\\npm\\opencode.cmd',
      'generic-validation',
      largeImpl,
      braceWorkspaceRoot
    );

    const value = String(spec.env!.OPENCODE_CONFIG_CONTENT);
    expect(value).not.toContain('{file:');
    expect(`OPENCODE_CONFIG_CONTENT=${value}`.length).toBeLessThanOrEqual(8191);
  });

  it('does not grow the opencode environment value with the generator context', () => {
    const empty = buildSpawn(
      opencodeDefinition,
      'C:\\Users\\developer\\AppData\\Roaming\\npm\\opencode.cmd',
      'generic-validation',
      emptyImpl,
      braceWorkspaceRoot
    );
    const large = buildSpawn(
      opencodeDefinition,
      'C:\\Users\\developer\\AppData\\Roaming\\npm\\opencode.cmd',
      'generic-validation',
      largeImpl,
      braceWorkspaceRoot
    );

    expect(String(large.spec.env!.OPENCODE_CONFIG_CONTENT).length).toBe(
      String(empty.spec.env!.OPENCODE_CONFIG_CONTENT).length
    );
  });

  // Asserting on the full form keeps the runner's fallback from quietly
  // absorbing growth in the system prompt.
  it('fits codex' + "'s full inline system context on the command line", () => {
    const { spec, adapted } = buildSpawn(
      codexDefinition,
      'C:\\Users\\developer\\AppData\\Roaming\\npm\\codex.cmd',
      'generic-validation',
      largeImpl
    );
    expect(spec.args[1]).toContain('developer_instructions=');
    expect(spec.args[1]).toContain('handoff_contract');
    expect(adapted.commandLineLength).toBeLessThanOrEqual(
      WINDOWS_COMMAND_LINE_BUDGET
    );
  });
});
