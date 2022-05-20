import { parseTargetString, targetToTargetString } from './parse-target-string';

const cases = [
  { input: 'one:two', expected: { project: 'one', target: 'two' } },
  {
    input: 'one:two:three',
    expected: { project: 'one', target: 'two', configuration: 'three' },
  },
  {
    input: 'one:"two:two":three',
    expected: { project: 'one', target: 'two:two', configuration: 'three' },
  },
];

describe('parseTargetString', () => {
  it.each(cases)('$input -> $expected', ({ input, expected }) => {
    expect(parseTargetString(input)).toEqual(expected);
  });
});

describe('targetToTargetString', () => {
  it.each(cases)('$expected -> $input', ({ input, expected }) => {
    expect(targetToTargetString(expected)).toEqual(input);
  });
});
