import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resetFormatterWarningsForTesting } from '../../../utils/formatters';
import { resolveFormatCommand } from './format-command';

describe('resolveFormatCommand', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-format-command-'));
    // The both-configured warning is warn-once module state.
    resetFormatterWarningsForTesting();
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns null when no formatter is configured', () => {
    expect(resolveFormatCommand(root, 'npx')).toBeNull();
  });

  it('renders the prettier command through the package manager exec prefix', () => {
    writeFileSync(join(root, '.prettierrc'), '{}');

    expect(resolveFormatCommand(root, 'pnpm exec')).toBe(
      'pnpm exec prettier --write --ignore-unknown <paths>'
    );
  });

  it('renders the oxfmt command when an oxfmt config is present', () => {
    writeFileSync(join(root, '.oxfmtrc.json'), '{}');

    expect(resolveFormatCommand(root, 'npx')).toBe(
      'npx oxfmt --no-error-on-unmatched-pattern <paths>'
    );
  });

  it('falls back to a formatter declared as a root dependency when no config exists', () => {
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ devDependencies: { prettier: '^3.0.0' } })
    );

    expect(resolveFormatCommand(root, 'npx')).toBe(
      'npx prettier --write --ignore-unknown <paths>'
    );
  });
});
