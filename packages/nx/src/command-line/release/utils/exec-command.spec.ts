import { execCommand } from './exec-command';

// A 3-byte character, so most chunk boundaries fall inside a character
const CJK = '\u4e2d';

function writer(stream: 'stdout' | 'stderr', exitCode = 0) {
  return `process.${stream}.write('a' + String.fromCharCode(${CJK.charCodeAt(0)}).repeat(200000)); process.exitCode = ${exitCode}`;
}

describe('execCommand', () => {
  it('should not corrupt multi-byte characters split across stdout chunks', async () => {
    const out = await execCommand(process.execPath, ['-e', writer('stdout')]);

    expect(out.includes('\uFFFD')).toBe(false);
    expect(out === 'a' + CJK.repeat(200_000)).toBe(true);
  });

  it('should not corrupt multi-byte characters split across stderr chunks', async () => {
    const err = await execCommand(process.execPath, [
      '-e',
      writer('stderr', 1),
    ]).catch((e) => e as string);

    expect(err.includes('\uFFFD')).toBe(false);
    expect(err === 'a' + CJK.repeat(200_000)).toBe(true);
  });
});
