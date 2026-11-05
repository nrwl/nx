// Compiler-option enum values, so callers can compare options without loading
// TypeScript. TypeScript 6 and 7.1 give each member here the same value.

export const ModuleKind = {
  None: 0,
  CommonJS: 1,
  AMD: 2,
  UMD: 3,
  System: 4,
  ES2015: 5,
  ES2020: 6,
  ES2022: 7,
  ESNext: 99,
  Node16: 100,
  Node18: 101,
  Node20: 102,
  NodeNext: 199,
  Preserve: 200,
} as const;

export const ModuleResolutionKind = {
  Classic: 1,
  Node10: 2,
  Node16: 3,
  NodeNext: 99,
  Bundler: 100,
} as const;

export const ScriptTarget = {
  ES2015: 2,
  ES2016: 3,
  ES2017: 4,
  ES2018: 5,
  ES2019: 6,
  ES2020: 7,
  ES2021: 8,
  ES2022: 9,
  ES2023: 10,
  ES2024: 11,
  ES2025: 12,
  ESNext: 99,
  JSON: 100,
  Latest: 99,
} as const;
