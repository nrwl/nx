import type { TsConfigOptions } from 'ts-node';
import type { CompilerOptions } from 'typescript';
/**
 * Optionally, if swc-node and tsconfig-paths are available in the current workspace, apply the require
 * register hooks so that .ts files can be used for writing custom workspace projects.
 *
 * If ts-node and tsconfig-paths are not available, the user can still provide an index.js file in
 * the root of their project and the fundamentals will still work (but
 * workspace path mapping will not, for example).
 *
 * @returns cleanup function
 */
export declare function registerTsProject(tsConfigPath: string): () => void;
/**
 * Optionally, if swc-node and tsconfig-paths are available in the current workspace, apply the require
 * register hooks so that .ts files can be used for writing custom workspace projects.
 *
 * If ts-node and tsconfig-paths are not available, the user can still provide an index.js file in
 * the root of their project and the fundamentals will still work (but
 * workspace path mapping will not, for example).
 *
 * @returns cleanup function
 * @deprecated This signature will be removed in Nx v19. You should pass the full path to the tsconfig in the first argument.
 */
export declare function registerTsProject(path: string, configFilename: string): any;
export declare function getSwcTranspiler(compilerOptions: CompilerOptions): (...args: unknown[]) => unknown;
export declare function getTsNodeTranspiler(compilerOptions: CompilerOptions, tsNodeOptions?: TsConfigOptions, preferTsNode?: boolean): (...args: unknown[]) => unknown;
export declare function getTranspiler(compilerOptions: CompilerOptions, tsConfigRaw?: unknown): () => (...args: unknown[]) => unknown;
/**
 * Register ts-node or swc-node given a set of compiler options.
 *
 * Note: Several options require enums from typescript. To avoid importing typescript,
 * use import type + raw values
 *
 * @returns cleanup method
 */
export declare function registerTranspiler(compilerOptions: CompilerOptions, tsConfigRaw?: unknown): () => void;
/**
 * @param tsConfigPath Adds the paths from a tsconfig file into node resolutions
 * @returns cleanup function
 */
export declare function registerTsConfigPaths(tsConfigPath: any): () => void;
/**
 * ts-node requires string values for enum based typescript options.
 * `register`'s signature just types the field as `object`, so we
 * unfortunately do not get any kind of type safety on this.
 */
export declare function getTsNodeCompilerOptions(compilerOptions: CompilerOptions): {
    [x: string]: any;
    allowImportingTsExtensions?: any;
    allowJs?: any;
    allowArbitraryExtensions?: any;
    allowSyntheticDefaultImports?: any;
    allowUmdGlobalAccess?: any;
    allowUnreachableCode?: any;
    allowUnusedLabels?: any;
    alwaysStrict?: any;
    baseUrl?: any;
    charset?: any;
    checkJs?: any;
    customConditions?: any;
    declaration?: any;
    declarationMap?: any;
    emitDeclarationOnly?: any;
    declarationDir?: any;
    disableSizeLimit?: any;
    disableSourceOfProjectReferenceRedirect?: any;
    disableSolutionSearching?: any;
    disableReferencedProjectLoad?: any;
    downlevelIteration?: any;
    emitBOM?: any;
    emitDecoratorMetadata?: any;
    exactOptionalPropertyTypes?: any;
    experimentalDecorators?: any;
    forceConsistentCasingInFileNames?: any;
    ignoreDeprecations?: any;
    importHelpers?: any;
    importsNotUsedAsValues?: any;
    inlineSourceMap?: any;
    inlineSources?: any;
    isolatedModules?: any;
    isolatedDeclarations?: any;
    jsx?: any;
    keyofStringsOnly?: any;
    lib?: any;
    libReplacement?: any;
    locale?: any;
    mapRoot?: any;
    maxNodeModuleJsDepth?: any;
    module?: any;
    moduleResolution?: any;
    moduleSuffixes?: any;
    moduleDetection?: any;
    newLine?: any;
    noEmit?: any;
    noCheck?: any;
    noEmitHelpers?: any;
    noEmitOnError?: any;
    noErrorTruncation?: any;
    noFallthroughCasesInSwitch?: any;
    noImplicitAny?: any;
    noImplicitReturns?: any;
    noImplicitThis?: any;
    noStrictGenericChecks?: any;
    noUnusedLocals?: any;
    noUnusedParameters?: any;
    noImplicitUseStrict?: any;
    noPropertyAccessFromIndexSignature?: any;
    assumeChangesOnlyAffectDirectDependencies?: any;
    noLib?: any;
    noResolve?: any;
    noUncheckedIndexedAccess?: any;
    out?: any;
    outDir?: any;
    outFile?: any;
    paths?: any;
    preserveConstEnums?: any;
    noImplicitOverride?: any;
    preserveSymlinks?: any;
    preserveValueImports?: any;
    project?: any;
    reactNamespace?: any;
    jsxFactory?: any;
    jsxFragmentFactory?: any;
    jsxImportSource?: any;
    composite?: any;
    incremental?: any;
    tsBuildInfoFile?: any;
    removeComments?: any;
    resolvePackageJsonExports?: any;
    resolvePackageJsonImports?: any;
    rewriteRelativeImportExtensions?: any;
    rootDir?: any;
    rootDirs?: any;
    skipLibCheck?: any;
    skipDefaultLibCheck?: any;
    sourceMap?: any;
    sourceRoot?: any;
    strict?: any;
    strictFunctionTypes?: any;
    strictBindCallApply?: any;
    strictNullChecks?: any;
    strictPropertyInitialization?: any;
    strictBuiltinIteratorReturn?: any;
    stripInternal?: any;
    suppressExcessPropertyErrors?: any;
    suppressImplicitAnyIndexErrors?: any;
    target?: any;
    traceResolution?: any;
    useUnknownInCatchVariables?: any;
    noUncheckedSideEffectImports?: any;
    resolveJsonModule?: any;
    types?: any;
    typeRoots?: any;
    verbatimModuleSyntax?: any;
    erasableSyntaxOnly?: any;
    esModuleInterop?: any;
    useDefineForClassFields?: any;
};
