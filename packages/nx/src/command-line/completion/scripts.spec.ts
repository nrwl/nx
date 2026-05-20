import { generateScript } from './scripts';

const SHELLS = ['bash', 'zsh', 'fish', 'powershell'] as const;
type Shell = (typeof SHELLS)[number];

describe('completion/scripts', () => {
  async function generate(shell: Shell): Promise<string> {
    return generateScript(shell);
  }

  // The shell wrappers are templated strings — a copy-paste slip (e.g. the
  // fish wrapper emitting NX_COMPLETE=bash) would ship green without these
  // string-invariant checks.
  for (const shell of SHELLS) {
    describe(shell, () => {
      it('wraps the script in the begin/end sentinels', async () => {
        const script = await generate(shell);
        expect(script).toContain('###-begin-nx-completions-###');
        expect(script).toContain('###-end-nx-completions-###');
      });

      it(`sets the NX_COMPLETE trigger to "${shell}"`, async () => {
        const script = await generate(shell);
        // POSIX wrappers use `NX_COMPLETE=<shell>`; PowerShell uses
        // `$env:NX_COMPLETE = '<shell>'`.
        expect(script).toMatch(new RegExp(`NX_COMPLETE(=|\\s=\\s')${shell}`));
      });

      it('does not set the trigger to any other shell', async () => {
        const script = await generate(shell);
        for (const other of SHELLS) {
          if (other === shell) continue;
          expect(script).not.toContain(`NX_COMPLETE=${other}`);
          expect(script).not.toContain(`NX_COMPLETE = '${other}'`);
        }
      });

      it('gates the stderr discard on NX_VERBOSE_LOGGING', async () => {
        const script = await generate(shell);
        // Both must be present: the debug var AND the default discard.
        // Together they prove the discard is conditional, not hardcoded.
        expect(script).toContain('NX_VERBOSE_LOGGING');
        expect(script).toContain(
          shell === 'powershell' ? '2>$null' : '2>/dev/null'
        );
      });
    });
  }

  describe('shell-specific invariants', () => {
    it('bash/zsh/fish wrappers walk up for a workspace-local nx', async () => {
      for (const shell of ['bash', 'zsh', 'fish'] as const) {
        const script = await generate(shell);
        // Assert the loop itself, not just a path mention — the
        // `.nx/installation` fallback probe is emitted only inside the
        // walk-up loop body, so its presence proves the loop is intact.
        expect(script).toContain('while');
        expect(script).toContain('node_modules/.bin/nx');
        expect(script).toContain('.nx/installation/node_modules/.bin/nx');
      }
    });

    it('the PowerShell wrapper walks up for a workspace-local nx.cmd', async () => {
      const script = await generate('powershell');
      expect(script).toContain('while');
      expect(script).toContain('node_modules\\.bin\\nx.cmd');
      expect(script).toContain('.nx\\installation\\node_modules\\.bin\\nx.cmd');
    });

    it('the zsh wrapper uses `compadd -d`, never invokes `_describe`', async () => {
      // `_describe` colon-splits each entry, mangling values like
      // `my-app:build`; `compadd -d` inserts the value literally. (The
      // wrapper's comments may mention `_describe` — only the invocation,
      // `_describe '...'`, is forbidden.)
      const script = await generate('zsh');
      expect(script).toContain('compadd -d');
      expect(script).not.toContain("_describe '");
    });
  });
});
