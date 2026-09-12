import type { Mock } from 'vitest';
import { execFile, execFileSync } from 'node:child_process';
import { checkWithPrettier, writeWithPrettier } from './prettier';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
  execFileSync: vi.fn(),
}));
vi.mock('../package-json', () => ({
  readModulePackageJson: vi.fn(() => ({
    packageJson: { bin: 'bin/prettier.cjs', version: '3.6.2' },
    path: '/ws/node_modules/prettier/package.json',
  })),
}));

// These paths were reachable once `parseFiles` started reading `-z` output:
// git no longer C-quotes them, so they arrive verbatim. Interpolated into a
// command string they close the quoting and run as shell, which is why both
// entry points spawn prettier with an argv array instead.
const HOSTILE = [
  'apps/a"b/index.ts',
  'apps/`id`/index.ts',
  'apps/$(id)/index.ts',
  'apps/$HOME/index.ts',
  'apps/a\\$b/index.ts',
];

/** Everything after `--` is the pattern list, whatever flags precede it. */
function patternsFrom(args: string[]): string[] {
  return args.slice(args.indexOf('--') + 1);
}

describe('prettier is spawned with argv, not a shell string', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hands writeWithPrettier patterns to prettier unaltered', () => {
    writeWithPrettier(HOSTILE);

    const [bin, args] = (execFileSync as unknown as Mock).mock.calls[0];
    expect(bin).toBe(process.execPath);
    expect(patternsFrom(args)).toEqual(HOSTILE);
  });

  it('hands checkWithPrettier patterns to prettier unaltered', () => {
    void checkWithPrettier(HOSTILE);

    const [bin, args] = (execFile as unknown as Mock).mock.calls[0];
    expect(bin).toBe(process.execPath);
    expect(patternsFrom(args)).toEqual(HOSTILE);
  });
});
