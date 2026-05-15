import { printCompletionScript } from './scripts';

const SHELLS = ['bash', 'zsh', 'fish', 'powershell'] as const;
type Shell = (typeof SHELLS)[number];

describe('completion/scripts', () => {
  let originalWrite: typeof process.stdout.write;
  let captured: string;

  beforeEach(() => {
    captured = '';
    originalWrite = process.stdout.write.bind(process.stdout);
    (process.stdout as any).write = (chunk: any) => {
      captured += String(chunk);
      return true;
    };
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
  });

  async function generate(shell: Shell): Promise<string> {
    captured = '';
    // force: true skips the PATH-probe advisory so the test is hermetic.
    await printCompletionScript(shell, { force: true });
    return captured;
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
    });
  }
});
