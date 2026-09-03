import {
  buildMasterInvocation,
  masterBootstrapPrompt,
  masterInvariant,
  MasterInvocationContext,
} from './invocations';

const runId = '20260715T101530-3f9a1c02';
const ctx: MasterInvocationContext = {
  runId,
  reconcileCommand: `pnpm exec nx migrate --run-id=${runId}`,
  runbookPath: `.nx/migrate-runs/${runId}/RUNBOOK.md`,
};

describe('master invocation prompts', () => {
  it.each([
    ['invariant', masterInvariant(ctx)],
    ['bootstrap', masterBootstrapPrompt(ctx)],
  ])(
    '%s names the reconcile command and the runbook on one line without %%',
    (_label, text) => {
      expect(text).toContain(ctx.reconcileCommand);
      expect(text).toContain(ctx.runbookPath);
      expect(text).not.toMatch(/[\r\n%]/);
    }
  );

  it('invariant names the run and forbids inferring progress from the conversation', () => {
    expect(masterInvariant(ctx)).toContain(`driving Nx migrate run ${runId}`);
    expect(masterInvariant(ctx)).toContain('never infer its progress');
  });
});

describe('buildMasterInvocation', () => {
  it('claude-code pre-allows the run-scoped handoff write and appends the invariant ahead of the bootstrap', () => {
    expect(buildMasterInvocation('claude-code', ctx)).toEqual({
      args: [
        '--allowedTools',
        `Edit(.nx/migrate-runs/${runId}/handoffs/**)`,
        '--append-system-prompt',
        masterInvariant(ctx),
        masterBootstrapPrompt(ctx),
      ],
    });
  });

  it('codex carries the invariant as developer instructions', () => {
    expect(buildMasterInvocation('codex', ctx)).toEqual({
      args: [
        '-c',
        `developer_instructions=${masterInvariant(ctx)}`,
        masterBootstrapPrompt(ctx),
      ],
    });
  });

  it('opencode carries the invariant through a transient agent config', () => {
    const spec = buildMasterInvocation('opencode', ctx);
    expect(spec.args).toEqual([
      '--agent',
      'nx-migrate',
      '--prompt',
      masterBootstrapPrompt(ctx),
    ]);
    expect(JSON.parse(spec.env.OPENCODE_CONFIG_CONTENT)).toEqual({
      agent: { 'nx-migrate': { prompt: masterInvariant(ctx) } },
    });
  });
});
