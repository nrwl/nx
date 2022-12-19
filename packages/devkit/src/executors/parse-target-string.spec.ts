import { parseTargetString, targetToTargetString } from './parse-target-string';

import * as splitTarget from 'nx/src/utils/split-target';

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
    jest
      .spyOn(splitTarget, 'splitTarget')
      .mockReturnValueOnce(Object.values(expected) as [string]);
    expect(parseTargetString(input, null)).toEqual(expected);
  });
});

describe('targetToTargetString', () => {
  it.each(cases)('$expected -> $input', ({ input, expected }) => {
    expect(targetToTargetString(expected)).toEqual(input);
  });
});
