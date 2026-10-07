import { escapeGlob } from './escape-glob';

describe('escapeGlob', () => {
  it.each(['\\', '*', '?', '[', ']', '{', '}', '(', ')', '!'])(
    'escapes %s',
    (char) => {
      expect(escapeGlob(`a${char}b`)).toEqual(`a\\${char}b`);
    }
  );

  it('round-trips every metacharacter', () => {
    const path = 'app/(group)/[id]/{a,b}/!x/*?.ts\\y';
    const unescape = (glob: string) => glob.replace(/\\(.)/g, '$1');
    expect(unescape(escapeGlob(path))).toEqual(path);
  });

  it('leaves plain paths and other characters alone', () => {
    expect(escapeGlob('libs/@scope/+state/a b,c|d.ts')).toEqual(
      'libs/@scope/+state/a b,c|d.ts'
    );
  });
});
