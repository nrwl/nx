import { splitTarget } from './split-target';

const cases = [
  { input: 'one', expected: ['one'] },
  { input: 'one:two', expected: ['one', 'two'] },
  { input: 'one:two:three', expected: ['one', 'two', 'three'] },
  { input: 'one:"two:two":three', expected: ['one', 'two:two', 'three'] },
];

describe('splitTarget', () => {
  it.each(cases)('$input -> $expected', ({ input, expected }) => {
    expect(splitTarget(input)).toEqual(expected);
  });
});
