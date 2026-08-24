import {
  printsFullTaskOutput,
  isStaticOutputStyle,
  printsTaskOutput,
} from './output';

describe('printsFullTaskOutput', () => {
  // This predicate decides whether a successful task's body is printed or
  // collapsed to a line, and its shape was reversed twice in one day: an
  // allow-list ("only `static` prints in full") and a deny-list ("only
  // `static-failures-only` collapses") agree on the three static values, so the
  // life-cycle specs that cover those cannot tell them apart. The named
  // non-static styles are where they differ, and where an allow-list silently
  // starts collapsing output a user explicitly asked to see.
  it.each([
    ['stream', true],
    ['stream-without-prefixes', true],
    ['dynamic-legacy', true],
    ['dynamic', true],
    ['tui', true],
    ['static', true],
    ['static-failures-only', false],
    ['summary', false],
  ])('%s prints full output: %s', (outputStyle, expected) => {
    expect(printsFullTaskOutput({ outputStyle })).toBe(expected);
  });

  it('prints a style it has never heard of in full, rather than collapsing it', () => {
    // The cases above enumerate every style that exists today, so an allow-list
    // of exactly those would satisfy them all - which is the shape this
    // predicate must NOT have. A style nobody has classified yet has to print,
    // so adding one to the union cannot silently start withholding output.
    expect(printsFullTaskOutput({ outputStyle: 'some-future-style' })).toBe(
      true
    );
  });

  it('collapses when no style was named, without assigning the field', () => {
    // The default is resolved here rather than written onto `outputStyle`,
    // because an absent style is what tells the orchestrator it may still
    // consult `shouldStreamOutput` for a continuous task. Assigning it broke 36
    // e2e tasks once already.
    const args: { outputStyle?: string } = {};
    expect(printsFullTaskOutput(args)).toBe(false);
    expect(printsFullTaskOutput({ outputStyle: undefined })).toBe(false);
    // Asserting the resolution is not enough - the point is that it happens
    // here and does not write the default back onto the caller's object, since
    // the orchestrator reads that same absence to decide streaming.
    expect('outputStyle' in args).toBe(false);
    expect(args.outputStyle).toBeUndefined();
  });

  it('prints full output under --verbose whatever the style', () => {
    expect(printsFullTaskOutput({ verbose: true })).toBe(true);
    expect(
      printsFullTaskOutput({
        verbose: true,
        outputStyle: 'static-failures-only',
      })
    ).toBe(true);
  });
});

describe('isStaticOutputStyle', () => {
  // Kept in step with the predicate above: both static styles select the same
  // life cycle and rule out the TUI, and the orchestrator additionally reads
  // this to force per-task streaming off.
  it.each([
    ['static', true],
    ['static-failures-only', true],
    ['stream', false],
    ['stream-without-prefixes', false],
    ['dynamic', false],
    ['dynamic-legacy', false],
    ['tui', false],
  ])('%s is a static style: %s', (style, expected) => {
    expect(isStaticOutputStyle(style)).toBe(expected);
  });

  it('treats an absent style as not-static, so streaming stays negotiable', () => {
    expect(isStaticOutputStyle(undefined)).toBe(false);
  });
});

describe('printsTaskOutput', () => {
  // `summary` addresses each task's log by path instead of printing it, so
  // anything that would put task bytes on the terminal has to check here first.
  // The batch fold is the one that bypasses the life cycle and would otherwise
  // dump a whole worker log into a run that asked for paths.
  it('is false only for summary', () => {
    expect(printsTaskOutput('summary')).toBe(false);
    for (const style of [
      'static',
      'static-failures-only',
      'stream',
      'stream-without-prefixes',
      'dynamic',
      'dynamic-legacy',
      'tui',
      undefined,
    ]) {
      expect(printsTaskOutput(style)).toBe(true);
    }
  });
});
