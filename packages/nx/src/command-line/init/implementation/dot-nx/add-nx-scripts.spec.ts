import {
  getDotNxWrapperVersionCommand,
  sanitizeWrapperScript,
} from './add-nx-scripts';

describe('getDotNxWrapperVersionCommand', () => {
  it('should invoke the nx.bat wrapper on Windows', () => {
    expect(getDotNxWrapperVersionCommand('win32')).toBe('.\\nx.bat --version');
  });

  it('should invoke the ./nx wrapper on non-Windows platforms', () => {
    expect(getDotNxWrapperVersionCommand('linux')).toBe('./nx --version');
    expect(getDotNxWrapperVersionCommand('darwin')).toBe('./nx --version');
  });
});

describe('sanitizeWrapperScript', () => {
  it('should remove any comments starting with //#', () => {
    const stripped = sanitizeWrapperScript(`// should not be removed
//# internal should be removed
const variable = 3;`);
    expect(stripped).not.toContain('internal');
    expect(stripped).toContain('variable = 3;');
  });

  it('should remove eslint-disable comments', () => {
    const stripped = sanitizeWrapperScript(`// should not be removed
// eslint-disable-next-line no-restricted-modules
const variable = 3;`);
    expect(stripped).not.toContain('no-restricted-modules');
    expect(stripped).toContain('variable = 3;');
  });

  it('should remove empty comments', () => {
    const stripped = sanitizeWrapperScript(`test; //`);
    expect(stripped.length).toEqual(5);
  });
});
