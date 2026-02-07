import type { Plugin } from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { generate } from './BabelHelpers.js';
import { CodeGenerator } from './CodeGenerator.js';
import { ComponentCompiler } from './ComponentCompiler.js';
import { DecoratorValidator } from './DecoratorValidator.js';
import type { FluffPluginOptions } from './interfaces/FluffPluginOptions.js';

export type { FluffPluginOptions } from './interfaces/FluffPluginOptions.js';

const VIRTUAL_EXPR_TABLE_ID = '@fluff/expr-table';

function findFluffSourcePath(): string | null
{
    const thisFile = fileURLToPath(import.meta.url);
    const distDir = path.dirname(thisFile);
    const cliPackageDir = path.dirname(distDir);
    const packagesDir = path.dirname(cliPackageDir);
    const fluffSrcPath = path.join(packagesDir, 'fluff', 'src');

    if (fs.existsSync(path.join(fluffSrcPath, 'index.ts')))
    {
        return fluffSrcPath;
    }
    return null;
}

interface CachedCompileResult
{
    code: string;
    watchFiles?: string[];
}

function getEntryPointPath(build: Parameters<Plugin['setup']>[0]): string | null
{
    const { entryPoints, stdin } = build.initialOptions;

    if (stdin?.resolveDir)
    {
        return null;
    }

    if (Array.isArray(entryPoints) && entryPoints.length > 0)
    {
        const [first] = entryPoints;
        return typeof first === 'string' ? first : first.in;
    }

    return null;
}

interface FileDecorators
{
    hasComponent: boolean;
    hasPipe: boolean;
}

function detectDecorators(source: string): FileDecorators
{
    const result: FileDecorators = { hasComponent: false, hasPipe: false };

    try
    {
        const ast = parse(source, {
            sourceType: 'module',
            plugins: ['typescript', 'decorators']
        });

        for (const node of ast.program.body)
        {
            if (t.isClassDeclaration(node) && node.decorators)
            {
                for (const decorator of node.decorators)
                {
                    if (t.isCallExpression(decorator.expression) && t.isIdentifier(decorator.expression.callee))
                    {
                        const { name } = decorator.expression.callee;
                        if (name === 'Component') result.hasComponent = true;
                        if (name === 'Pipe') result.hasPipe = true;
                    }
                }
            }
            if (t.isExportNamedDeclaration(node) && t.isClassDeclaration(node.declaration) && node.declaration.decorators)
            {
                for (const decorator of node.declaration.decorators)
                {
                    if (t.isCallExpression(decorator.expression) && t.isIdentifier(decorator.expression.callee))
                    {
                        const { name } = decorator.expression.callee;
                        if (name === 'Component') result.hasComponent = true;
                        if (name === 'Pipe') result.hasPipe = true;
                    }
                }
            }
            if (t.isExportDefaultDeclaration(node) && t.isClassDeclaration(node.declaration) && node.declaration.decorators)
            {
                for (const decorator of node.declaration.decorators)
                {
                    if (t.isCallExpression(decorator.expression) && t.isIdentifier(decorator.expression.callee))
                    {
                        const { name } = decorator.expression.callee;
                        if (name === 'Component') result.hasComponent = true;
                        if (name === 'Pipe') result.hasPipe = true;
                    }
                }
            }
        }
    }
    catch
    {
    }

    return result;
}

export function fluffPlugin(options: FluffPluginOptions): Plugin
{
    const compiler = new ComponentCompiler();
    const fluffSrcPath = findFluffSourcePath();
    const compiledCache = new Map<string, CachedCompileResult>();
    let entryPointPath: string | null = null;

    // noinspection JSUnusedGlobalSymbols
    return {
        name: 'fluff',
        setup(build): void
        {
            entryPointPath = getEntryPointPath(build);

            build.onStart(async() =>
            {
                CodeGenerator.resetGlobalState();
                compiledCache.clear();

                const componentPaths = await compiler.discoverComponents(options.srcDir);

                for (const componentPath of componentPaths)
                {
                    const result = await compiler.compileComponentForBundle(
                        componentPath,
                        options.minify,
                        options.sourcemap,
                        options.skipDefine,
                        options.production
                    );

                    compiledCache.set(componentPath, {
                        code: result.code,
                        watchFiles: result.watchFiles
                    });
                }
            });

            build.onLoad({ filter: /\.ts$/ }, async(args) =>
            {
                const source = fs.readFileSync(args.path, 'utf-8');
                const decorators = detectDecorators(source);

                if (decorators.hasComponent)
                {
                    const cached = compiledCache.get(args.path);
                    if (cached)
                    {
                        return {
                            contents: cached.code,
                            loader: 'js',
                            resolveDir: path.dirname(args.path),
                            watchFiles: cached.watchFiles
                        };
                    }

                    const result = await compiler.compileComponentForBundle(
                        args.path,
                        options.minify,
                        options.sourcemap,
                        options.skipDefine,
                        options.production
                    );
                    return {
                        contents: result.code,
                        loader: 'js',
                        resolveDir: path.dirname(args.path),
                        watchFiles: result.watchFiles
                    };
                }

                if (decorators.hasPipe)
                {
                    const transformed = await compiler.transformPipeDecorators(source, args.path);
                    DecoratorValidator.validate(transformed, args.path);
                    return {
                        contents: transformed,
                        loader: 'ts',
                        resolveDir: path.dirname(args.path)
                    };
                }

                if (!entryPointPath || args.path !== entryPointPath)
                {
                    return null;
                }

                const ast = parse(source, {
                    sourceType: 'module',
                    plugins: ['typescript', 'decorators']
                });

                const exprTableImport = t.importDeclaration(
                    [],
                    t.stringLiteral(VIRTUAL_EXPR_TABLE_ID)
                );

                ast.program.body.push(exprTableImport);

                const output = generate(ast, { compact: false });
                return {
                    contents: output.code,
                    loader: 'ts',
                    resolveDir: path.dirname(args.path)
                };
            });

            build.onResolve({ filter: new RegExp(`^${VIRTUAL_EXPR_TABLE_ID.replace('/', '\\/')}$`) }, () =>
            {
                return { path: VIRTUAL_EXPR_TABLE_ID, namespace: 'fluff-virtual' };
            });

            build.onLoad({ filter: /.*/, namespace: 'fluff-virtual' }, () =>
            {
                const exprTable = CodeGenerator.generateGlobalExprTable();
                return {
                    contents: exprTable || '',
                    loader: 'js',
                    resolveDir: options.srcDir
                };
            });


            if (fluffSrcPath)
            {
                build.onResolve({ filter: /^@fluffjs\/fluff$/ }, () =>
                {
                    return { path: path.join(fluffSrcPath, 'index.ts') };
                });

                build.onResolve({ filter: /^@fluffjs\/fluff\// }, (args) =>
                {
                    const subPath = args.path.replace('@fluffjs/fluff/', '');
                    return { path: path.join(fluffSrcPath, subPath + '.ts') };
                });

                build.onResolve({ filter: /\.js$/ }, (args) =>
                {
                    if (args.resolveDir.includes(fluffSrcPath))
                    {
                        const tsPath = path.join(args.resolveDir, args.path.replace('.js', '.ts'));
                        if (args.path.includes('types/component'))
                        {
                            return { path: args.path, external: true };
                        }
                        return { path: tsPath };
                    }
                    return null;
                });
            }
        }
    };
}
