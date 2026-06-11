/**
 * Checks if `@nx/js` is installed by attempting to resolve its `package.json`.
 *
 * Lives in its own module so unit tests can `jest.doMock` it without having to
 * intercept Node's resolver at the global level. The previous in-`package-json`
 * definition was unreachable to mocks because callers in the same module
 * referenced it via the local lexical binding rather than `module.exports`.
 */
export declare function hasNxJsPlugin(projectRoot: string, workspaceRoot: string): boolean;
