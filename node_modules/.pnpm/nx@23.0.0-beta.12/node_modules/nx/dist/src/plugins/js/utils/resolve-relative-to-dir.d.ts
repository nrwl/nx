/**
 * NOTE: This function is in its own file because it is not possible to mock
 * require.resolve directly in jest https://github.com/jestjs/jest/issues/9543
 */
export declare function resolveRelativeToDir(path: string, relativeToDir: any): string;
