import { describe, expect, it } from 'vitest';
import {
  isStandardJsFile,
  JS_ALL_EXT_REGEX,
  TS_ALL_EXT_REGEX,
} from './regex-filters';

describe('TS_ALL_EXT_REGEX', () => {
  it.each([
    ['file.ts'],
    ['file.cts'],
    ['file.mts'],
    ['file.tsx'],
    ['file.ts?query'],
  ])('should match .ts files', (filename) => {
    expect(filename).toMatch(TS_ALL_EXT_REGEX);
  });

  it.each([['file.js'], ['file.cjs'], ['file.mjs'], ['file']])(
    'should not match other files',
    (filename) => {
      expect(filename).not.toMatch(TS_ALL_EXT_REGEX);
    }
  );
});

describe('JS_ALL_EXT_REGEX', () => {
  it.each([
    ['file.js'],
    ['file.cjs'],
    ['file.mjs'],
    ['file.jsx'],
    ['file.js?query'],
  ])('should match .ts files', (filename) => {
    expect(filename).toMatch(JS_ALL_EXT_REGEX);
  });

  it.each([['file.tsx'], ['file.ts'], ['file.cts'], ['file.mts'], ['file']])(
    'should not match other files',
    (filename) => {
      expect(filename).not.toMatch(JS_ALL_EXT_REGEX);
    }
  );
});

describe('isStandardJsFile', () => {
  it.each([['file.js'], ['file.cjs'], ['file.mjs']])(
    'should match %s files',
    (filename) => {
      expect(isStandardJsFile(filename)).toBeTruthy();
    }
  );

  it.each([
    ['file.tsx'],
    ['file.ts'],
    ['file.cts'],
    ['file.mts'],
    ['file.jsx'],
    ['file.js?query'],
    ['file'],
  ])('should not match other files', (filename) => {
    expect(isStandardJsFile(filename)).toBeFalsy();
  });
});
