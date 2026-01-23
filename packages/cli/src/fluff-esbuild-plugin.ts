import type { Plugin } from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ComponentCompiler } from './ComponentCompiler.js';

export interface FluffPluginOptions
{
    srcDir: string;
    minify?: boolean;
    sourcemap?: boolean;
}

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

export function fluffPlugin(options: FluffPluginOptions): Plugin
{
    const compiler = new ComponentCompiler();
    let componentsDiscovered = false;
    const fluffSrcPath = findFluffSourcePath();

    return {
        name: 'fluff',
        setup(build)
        {
            build.onStart(async() =>
            {
                if (!componentsDiscovered)
                {
                    await compiler.discoverComponents(options.srcDir);
                    componentsDiscovered = true;
                }
            });

            build.onLoad({ filter: /\.component\.ts$/ }, async(args) =>
            {
                const result = await compiler.compileComponentForBundle(args.path, options.minify, options.sourcemap);
                return {
                    contents: result.code,
                    loader: 'js',
                    resolveDir: path.dirname(args.path),
                    watchFiles: result.watchFiles
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
