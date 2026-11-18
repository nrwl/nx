import { describe, expect, it } from 'vitest';
import { statsWarningsToString } from './stats';

describe('statsWarningsToString', () => {
  it.each([
    [
      'keep a warning without a leading "Error: " prefix intact',
      "  ⚠ TS2322: Type 'string' is not assignable to type 'number'.\n",
      "\n/root/src/app.ts:5:8 - Warning:   ⚠ TS2322: Type 'string' is not assignable to type 'number'.\n\n\n",
    ],
    [
      'keep a colored severity marker intact',
      "  \u001b[33m⚠\u001b[0m TS2322: Type 'string' is not assignable to type 'number'.\n\u001b[0m",
      "\n/root/src/app.ts:5:8 - Warning:   \u001b[33m⚠\u001b[0m TS2322: Type 'string' is not assignable to type 'number'.\n\u001b[0m\n\n",
    ],
    [
      'keep "Error: " that is part of the warning text',
      '  ⚠ src/Error: main.js exceeded maximum budget.\n',
      '\n/root/src/app.ts:5:8 - Warning:   ⚠ src/Error: main.js exceeded maximum budget.\n\n\n',
    ],
    [
      'strip only the leading "Error: " prefix rspack 1.3 adds',
      '  ⚠ Error: src/Error: main.js exceeded maximum budget.\n',
      '\n/root/src/app.ts:5:8 - Warning: src/Error: main.js exceeded maximum budget.\n\n\n',
    ],
  ])('should %s', (_, message, expected) => {
    expect(
      statsWarningsToString(
        { warnings: [{ message, file: '/root/src/app.ts', loc: '5:8' }] },
        { colors: false }
      )
    ).toBe(expected);
  });
});
