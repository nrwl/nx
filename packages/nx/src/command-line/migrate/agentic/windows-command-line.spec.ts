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
 * are written, padded to 260 characters so every path built from it carries a
 * worst-case Windows root.
 */
describe('windows command line', () => {
  const originalPlatform = process.platform;
  let base: string;
  let workspaceRoot: string;
  let braceWorkspaceRoot: string;

  // Long enough that its own contribution to every path is visible.
  const baseMigration = {
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

  const shim = (agent: string) =>
    `C:\\Users\\developer\\AppData\\Roaming\\npm\\${agent}.cmd`;
  const agents: ReadonlyArray<[string, AgentDefinition, string]> = [
    ['claude-code', claudeCodeDefinition, shim('claude')],
    ['codex', codexDefinition, shim('codex')],
    ['opencode', opencodeDefinition, shim('opencode')],
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

  // In author mode, null `impl` selects the prompt-only builder.
  function buildSpawn(
    definition: AgentDefinition,
    shimBinary: string,
    mode: AgenticPromptMode,
    impl: typeof emptyImpl | null,
    root: string = workspaceRoot,
    migration: typeof baseMigration = baseMigration
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
      formatCommand:
        mode === 'generic-validation'
          ? null
          : 'npx prettier --write --ignore-unknown -- <paths>',
      pmExec: 'npx',
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
    });

    // Author mode without generator output uses the prompt-only builder.
    it('stays within the budget in author mode with no generator context', () => {
      const { adapted } = buildSpawn(definition, shimBinary, 'author', null);

      expect(adapted.commandLineLength).toBeLessThanOrEqual(
        WINDOWS_COMMAND_LINE_BUDGET
      );
    });

    // The migration identity reaches the command line through the prompt and
    // handoff paths, and `migrations.json` caps neither package nor name.
    it('costs the same on the command line whatever the migration is named', () => {
      const { adapted } = buildSpawn(
        definition,
        shimBinary,
        'author',
        largeImpl,
        workspaceRoot,
        { ...baseMigration, name: 'n'.repeat(5000) }
      );

      expect(adapted.commandLineLength).toBeLessThanOrEqual(
        WINDOWS_COMMAND_LINE_BUDGET
      );
      expect(adapted.commandLineLength).toBe(
        buildSpawn(definition, shimBinary, 'author', largeImpl).adapted
          .commandLineLength
      );
    });
  });

  // opencode is the only agent that sets an environment value, and cmd.exe
  // drops an inherited variable over its own 8191-character limit.
  it('keeps the opencode file reference under the variable limit', () => {
    const { spec } = buildSpawn(
      opencodeDefinition,
      shim('opencode'),
      'generic-validation',
      largeImpl
    );

    const value = String(spec.env!.OPENCODE_CONFIG_CONTENT);
    expect(value).toContain('{file:');
    expect(`OPENCODE_CONFIG_CONTENT=${value}`.length).toBeLessThanOrEqual(8191);
  });

  // A `}` in the root defeats the `{file:<path>}` substitution and sends the
  // prompt through the environment, which the runner's command-line budget does
  // not measure.
  it('keeps opencode under the environment variable limit when the workspace path defeats the file substitution', () => {
    const inlined = (impl: typeof emptyImpl) =>
      String(
        buildSpawn(
          opencodeDefinition,
          shim('opencode'),
          'generic-validation',
          impl,
          braceWorkspaceRoot
        ).spec.env!.OPENCODE_CONFIG_CONTENT
      );
    const value = inlined(largeImpl);

    expect(value).not.toContain('{file:');
    expect(`OPENCODE_CONFIG_CONTENT=${value}`.length).toBeLessThanOrEqual(8191);
    // The inlined prompt carries no generator output, so its size does not
    // track what the generator produced.
    expect(value.length).toBe(inlined(emptyImpl).length);
  });

  // The budget matrix measures this full form without the runner's fallback.
  it("passes codex's full inline system context to the Windows shim", () => {
    const { spec } = buildSpawn(
      codexDefinition,
      shim('codex'),
      'generic-validation',
      largeImpl
    );
    expect(spec.args[1]).toContain('developer_instructions=');
    expect(spec.args[1]).toContain('handoff_contract');
  });
});
