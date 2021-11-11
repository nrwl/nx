import { splitTarget } from './split-target';

describe('splitTarget', () => {
  it('should work', () => {
    expect(splitTarget('one')).toEqual(['one']);
    expect(splitTarget('one:two')).toEqual(['one', 'two']);
    expect(splitTarget('one:two:three')).toEqual(['one', 'two', 'three']);
    expect(splitTarget('one:"two:two":three')).toEqual([
      'one',
      'two:two',
      'three',
    ]);
  });
});
