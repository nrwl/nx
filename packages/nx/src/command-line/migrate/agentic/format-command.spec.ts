import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolveFormatCommand } from './format-command';

describe('resolveFormatCommand', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-format-command-'));
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
});
