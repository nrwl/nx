import { dirname } from 'path';
import * as pc from 'picocolors';
import { getRunNxBaseCommand } from '../../../utils/child-process';
import { FileChange } from '../../../generators/tree';
import { logger } from '../../../utils/logger';
import {
  detectPackageManager,
  getPackageManagerCommand,
} from '../../../utils/package-manager';
import { resetSgrAfterAgent } from '../migrate-output';
import { mkdirSafely, stepHandoffPath } from './handoff';
import { buildGenericValidationUserPrompt } from './prompts/generic-validation';
import { buildHybridPromptUserPrompt } from './prompts/hybrid-prompt-migration';
import { buildPromptMigrationUserPrompt } from './prompts/prompt-migration';
import { AgenticPromptMode, buildSystemPrompt } from './prompts/system-prompt';
import { getAgentDefinition } from './registry';
import { runAgentic } from './runner';
import { EnabledResolvedAgentic, HandoffOutcome } from './types';

/**
 * Context describing the deterministic (generator) half of a migration, used
 * to seed the agent's prompt with what just ran. Required for hybrid prompt
 * migrations (`buildHybridPromptUserPrompt`) and for generic-validation runs.
 */
export interface AgenticPromptImplContext {
  logs: string;
  changes: FileChange[];
  agentContext: string[];
  hasDiffContext: boolean;
}

export interface AgenticStepResult {
  /** Agent's handoff summary, or a placeholder when the user marked complete. */
  summary: string;
  /**
   * True when the agent didn't write a valid handoff and the user told nx to
   * continue anyway. The caller uses this to swap the outcome label
   * accordingly.
   */
  ambiguous: boolean;
}

export interface RunAgenticPromptStepInput {
  root: string;
  migration: {
    package: string;
    name: string;
    version: string;
    description?: string;
    prompt?: string;
  };
  agentic: EnabledResolvedAgentic;
  runDir: string;
  installDepsIfChanged: () => Promise<void>;
  implContext?: AgenticPromptImplContext;
  mode?: AgenticPromptMode;
}

/**
 * Spawns the configured AI agent against a migration step, awaits its handoff,
 * and translates the outcome into a structured result the executor can branch
 * on. Throws on failure / abort; returns a result with `ambiguous` set when
 * the agent exited without writing a handoff and the user chose to continue.
 *
 * `installDepsIfChanged` is a callback rather than a `ChangedDepInstaller`
 * instance so this module stays decoupled from the executor's internal state.
 * The structural `migration` type captures only the fields read here, keeping
 * the file free of cross-imports with the orchestrator.
 */
export async function runAgenticPromptStep(
  input: RunAgenticPromptStepInput
): Promise<AgenticStepResult> {
  const {
    root,
    migration,
    agentic,
    runDir,
    installDepsIfChanged,
    implContext,
    mode = 'author',
  } = input;

  const handoffFilePath = stepHandoffPath(runDir, migration);
  // The system prompt tells the agent the parent dir exists, so the agent
  // doesn't defensively `mkdir -p` (which triggers a workspace-permission
  // prompt in agents like Claude Code every run).
  mkdirSafely(
    dirname(handoffFilePath),
    `handoff directory for ${migration.name}`
  );
  const pm = detectPackageManager(root);
  const systemContext = buildSystemPrompt({
    workspaceRoot: root,
    handoffFileAbsolutePath: handoffFilePath,
    packageManager: pm,
    nxInvocation: getRunNxBaseCommand(getPackageManagerCommand(pm, root), root),
    mode,
  });

  let userPrompt: string;
  if (mode === 'generic-validation') {
    if (!implContext) {
      throw new Error(
        `Internal error: generic-validation mode requires impl context (logs, changes, agentContext, hasDiffContext) but none was provided.`
      );
    }
    userPrompt = buildGenericValidationUserPrompt({
      package: migration.package,
      name: migration.name,
      version: migration.version,
      description: migration.description,
      handoffFileAbsolutePath: handoffFilePath,
      impl: implContext,
    });
  } else {
    const promptCtx = {
      package: migration.package,
      name: migration.name,
      version: migration.version,
      description: migration.description,
      promptPath: migration.prompt!,
      handoffFileAbsolutePath: handoffFilePath,
    };
    userPrompt = implContext
      ? buildHybridPromptUserPrompt({ ...promptCtx, impl: implContext })
      : buildPromptMigrationUserPrompt(promptCtx);
  }

  const definition = getAgentDefinition(agentic.selectedAgent.id);
  if (!definition) {
    throw new Error(
      `No agent definition registered for "${agentic.selectedAgent.id}".`
    );
  }

  const phase = mode === 'generic-validation' ? 'Validating' : 'Running prompt';
  logger.info(pc.dim(`→ ${phase} with ${agentic.selectedAgent.displayName}…`));

  const outcome: HandoffOutcome = await runAgentic({
    detected: agentic.selectedAgent,
    definition,
    invocationContext: {
      systemContext,
      userPrompt,
      workspaceRoot: root,
    },
    handoffFilePath,
  });

  // Some agent TUIs leave cursor/SGR state behind on exit. Reset before our
  // own log lines so the outcome line lands clean instead of overlaid on the
  // agent's trailing status bar.
  resetSgrAfterAgent();

  switch (outcome.kind) {
    case 'success':
      await installDepsIfChanged();
      return { summary: outcome.summary, ambiguous: false };
    case 'ambiguous-continue':
      await installDepsIfChanged();
      return {
        summary: 'No handoff file was written; marked complete by user.',
        ambiguous: true,
      };
    case 'failed': {
      const failLabel =
        mode === 'generic-validation' ? 'Validation failed' : 'Failed';
      logger.info(`${pc.red('✗')} ${failLabel}: ${outcome.summary}`);
      throw new Error(
        `Prompt migration ${migration.package}: ${migration.name} failed.`
      );
    }
    case 'ambiguous-abort':
      // When Ctrl+C masked an underlying crash, the runner forwards the
      // pre-rendered cause lines so we surface them before "Aborted by
      // user" — otherwise the user sees only "aborted" with no signal that
      // anything also crashed. When the abort came from the user picking
      // "abort" at the prompt, the cause was already shown there.
      if (outcome.causeSummary && outcome.causeSummary.length > 0) {
        logger.info(pc.dim('The agent run ended without a usable handoff:'));
        for (const line of outcome.causeSummary) {
          logger.info(pc.dim(`  ${line}`));
        }
      }
      logger.info(`${pc.red('✗')} Aborted by user.`);
      throw new Error(
        `Prompt migration ${migration.package}: ${migration.name} was aborted by user.`
      );
  }
}
