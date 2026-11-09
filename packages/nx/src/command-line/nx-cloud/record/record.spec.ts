import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { output } from '../../../utils/output';
import { recordHandler } from './record';

vi.mock('../../../config/nx-json', () => ({ readNxJson: () => ({}) }));
vi.mock('../../../utils/nx-cloud-utils', () => ({
  isNxCloudUsed: () => false,
}));

describe('recordHandler without Nx Cloud', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nx-record-'));
    vi.spyOn(output, 'warn').mockImplementation(() => {});
    vi.spyOn(output, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  it('passes each argument to the wrapped command verbatim', async () => {
    const script = join(dir, 'record-args.js');
    writeFileSync(
      script,
      'require("fs").writeFileSync(process.argv[2], JSON.stringify(process.argv.slice(3)))'
    );
    const received = join(dir, 'received.json');
    const head = `--head=feature;echo x>${join(dir, 'injected')}`;

    const exitCode = await recordHandler({
      '--': [
        JSON.stringify(process.execPath),
        script,
        received,
        head,
        '$(echo sub)',
        'a b',
        '',
        3 as unknown as string,
      ],
    });

    expect(exitCode).toBe(0);
    expect(readdirSync(dir).sort()).toEqual([
      'received.json',
      'record-args.js',
    ]);
    expect(JSON.parse(readFileSync(received, 'utf-8'))).toEqual([
      head,
      '$(echo sub)',
      'a b',
      '',
      '3',
    ]);
  });

  it('runs a single command string through the shell', async () => {
    const out = join(dir, 'out');
    const exitCode = await recordHandler({
      '--': [
        `echo a > ${JSON.stringify(out)} && echo b >> ${JSON.stringify(out)}`,
      ],
    });

    expect(exitCode).toBe(0);
    expect(readFileSync(out, 'utf-8').replace(/\s+/g, '')).toBe('ab');
  });

  it('exits with the code of the wrapped command', async () => {
    expect(
      await recordHandler({
        '--': [JSON.stringify(process.execPath), '-e', 'process.exitCode=3'],
      })
    ).toBe(3);
  });
});
