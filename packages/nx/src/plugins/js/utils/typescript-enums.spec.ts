import { dirname, join } from 'path';
import {
  ModuleKind,
  ModuleResolutionKind,
  ScriptTarget,
} from './typescript-enums';

// The repo's `typescript` is TS 6, and 7.1 is aliased.
const typescript6 = require('typescript');
const typescript71Root = dirname(
  require.resolve('@typescript/native/package.json')
);

describe('TypeScript compiler-option enums', () => {
  it.each([
    ['ModuleKind', ModuleKind, 'moduleKind'],
    ['ModuleResolutionKind', ModuleResolutionKind, 'moduleResolutionKind'],
    ['ScriptTarget', ScriptTarget, 'scriptTarget'],
  ])(
    'should match %s in TypeScript 6 and 7.1',
    async (enumName, constants, enumFile) => {
      const { [enumName]: typescript71Enum } = await import(
        join(typescript71Root, `dist/enums/${enumFile}.enum.js`)
      );

      for (const [member, value] of Object.entries(constants)) {
        expect([member, typescript6[enumName][member]]).toEqual([
          member,
          value,
        ]);
        expect([member, typescript71Enum[member]]).toEqual([member, value]);
      }
    }
  );
});
