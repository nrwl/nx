import {
  buildFinalValidationInstructions,
  type FinalValidationInstructionsContext,
} from './final-validation';

const baseCtx: FinalValidationInstructionsContext = {
  runId: 'run-1',
  baseRef: 'beef0002beef0002beef0002beef0002beef0002',
  nxInvocation: 'pnpm exec nx',
  handoffFileAbsolutePath:
    '/abs/workspace/.nx/migrate-runs/run-1/handoffs/step-3.json',
};

describe('buildFinalValidationInstructions', () => {
  it('selects the affected projects from the base ref with the workspace nx invocation', () => {
    const out = buildFinalValidationInstructions(baseCtx);

    expect(out).toContain('final validation pass of Nx migrate run run-1');
    expect(out).toContain(
      '`pnpm exec nx affected --base beef0002beef0002beef0002beef0002beef0002 -t <targets>`'
    );
    expect(out).toContain(
      '`git diff beef0002beef0002beef0002beef0002beef0002`'
    );
    expect(out).not.toContain('run-many -t <targets>');
    expect(out).toContain('<validation_instructions>');
    expect(out).toContain('lint first, then build, then unit tests');
    expect(out).toContain('possibly pre-existing');
    expect(out).toContain('<scope_rules>');
    expect(out).toContain('`nx affected --base <ref> -t <targets>`');
    expect(out).toContain(
      `<handoff_path>\n${baseCtx.handoffFileAbsolutePath}\n</handoff_path>`
    );
  });

  it('falls back to every project when the run recorded no base ref', () => {
    const out = buildFinalValidationInstructions({ ...baseCtx, baseRef: null });

    expect(out).toContain('could not record the commit it started from');
    expect(out).toContain('`pnpm exec nx run-many -t <targets>`');
    expect(out).not.toContain('nx affected --base beef');
  });

  it('collapses interpolated values to one line', () => {
    // A break in a value could otherwise open a tag at a line start.
    const out = buildFinalValidationInstructions({
      ...baseCtx,
      runId: 'run\n1',
      nxInvocation: 'npx\nnx',
    });

    expect(out).toContain('migrate run run 1.');
    expect(out).toContain('`npx nx affected --base');
  });
});
