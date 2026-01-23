import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { gzipSync } from 'zlib';
import { ComponentCompiler } from './ComponentCompiler.js';
import { fluffPlugin } from './fluff-esbuild-plugin.js';
import { transformIndexHtml } from './IndexHtmlTransformer.js';
import type { FluffConfig, FluffTarget } from './types/FluffConfig.js';
import { DEFAULT_CONFIG } from './types/FluffConfig.js';

interface CliOptions
{
    cwd?: string;
    nxPackage?: string;
}

export class Cli
{
    private readonly cwd: string;
    private readonly nxPackage: string | undefined;

    public constructor(options: CliOptions = {})
    {
        this.cwd = options.cwd ?? process.env.INIT_CWD ?? process.cwd();
        this.nxPackage = options.nxPackage;
    }

    public async run(args: string[]): Promise<void>
    {
        const [command, ...commandArgs] = args;

        switch (command)
        {
            case 'init':
                this.init(commandArgs);
                break;
            case 'build':
                await this.build(commandArgs);
                break;
            case 'serve':
                await this.serve(commandArgs);
                break;
            case 'help':
            case '--help':
            case '-h':
            case undefined:
                this.showHelp();
                break;
            default:
                console.error(`Unknown command: ${command}`);
                this.showHelp();
                process.exit(1);
        }
    }

    private showHelp(): void
    {
        console.log(`
Fluff CLI - Build tool for Fluff components

Usage: fluff <command> [options]

Commands:
  init [target]           Initialize a new fluff.json configuration
  build [target]          Build the project (or specific target)
  serve [target]          Start dev server with watch mode
  help                    Show this help message

Options:
  --nx <package>          Use nx workspace, specify package name
  --cwd <dir>             Set working directory

Examples:
  fluff init              Create fluff.json with default configuration
  fluff build             Build the default target
  fluff build app         Build the 'app' target
  fluff --nx @myorg/app build   Build an nx package
`);
    }

    private getProjectRoot(): string
    {
        if (this.nxPackage)
        {
            return this.findNxPackageRoot(this.nxPackage);
        }
        return this.cwd;
    }

    private findNxPackageRoot(packageName: string): string
    {
        const nxJsonPath = this.findNxJson(this.cwd);
        if (!nxJsonPath)
        {
            throw new Error('Not in an nx workspace (nx.json not found)');
        }

        const workspaceRoot = path.dirname(nxJsonPath);
        const packagesDir = path.join(workspaceRoot, 'packages');
        const appsDir = path.join(workspaceRoot, 'apps');
        const libsDir = path.join(workspaceRoot, 'libs');

        for (const searchDir of [packagesDir, appsDir, libsDir])
        {
            if (!fs.existsSync(searchDir)) continue;

            const entries = fs.readdirSync(searchDir, { withFileTypes: true });
            for (const entry of entries)
            {
                if (!entry.isDirectory()) continue;

                const pkgJsonPath = path.join(searchDir, entry.name, 'package.json');
                if (fs.existsSync(pkgJsonPath))
                {
                    const pkgJsonContent: unknown = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
                    if (typeof pkgJsonContent !== 'object' || pkgJsonContent === null) continue;
                    if ('name' in pkgJsonContent && pkgJsonContent.name === packageName)
                    {
                        return path.join(searchDir, entry.name);
                    }
                }
            }
        }

        throw new Error(`nx package '${packageName}' not found in workspace`);
    }

    private findNxJson(startDir: string): string | null
    {
        let dir = startDir;
        while (dir !== path.dirname(dir))
        {
            const nxJsonPath = path.join(dir, 'nx.json');
            if (fs.existsSync(nxJsonPath))
            {
                return nxJsonPath;
            }
            dir = path.dirname(dir);
        }
        return null;
    }

    private getConfigPath(): string
    {
        return path.join(this.getProjectRoot(), 'fluff.json');
    }

    private isFluffConfig(value: unknown): value is FluffConfig
    {
        if (typeof value !== 'object' || value === null) return false;
        if (!('version' in value) || typeof value.version !== 'string') return false;
        return !(!('targets' in value) || typeof value.targets !== 'object' || value.targets === null);

    }

    private loadConfig(): FluffConfig
    {
        return this.loadConfigFrom(this.getConfigPath());
    }

    private loadConfigFrom(configPath: string): FluffConfig
    {
        if (!fs.existsSync(configPath))
        {
            throw new Error(`fluff.json not found at ${configPath}. Run 'fluff init' first.`);
        }

        const content = fs.readFileSync(configPath, 'utf-8');
        const parsed: unknown = JSON.parse(content);
        if (!this.isFluffConfig(parsed))
        {
            throw new Error('Invalid fluff.json: missing required fields');
        }
        return parsed;
    }

    private tryResolveNxProject(nameOrDir: string, workspaceRoot: string): string | null
    {
        const packagesDir = path.join(workspaceRoot, 'packages');
        const appsDir = path.join(workspaceRoot, 'apps');
        const libsDir = path.join(workspaceRoot, 'libs');

        for (const searchDir of [packagesDir, appsDir, libsDir])
        {
            if (!fs.existsSync(searchDir)) continue;

            const directPath = path.join(searchDir, nameOrDir);
            if (fs.existsSync(path.join(directPath, 'fluff.json')))
            {
                return directPath;
            }

            const entries = fs.readdirSync(searchDir, { withFileTypes: true });
            for (const entry of entries)
            {
                if (!entry.isDirectory()) continue;

                const projectPath = path.join(searchDir, entry.name);
                const pkgJsonPath = path.join(projectPath, 'package.json');

                if (fs.existsSync(pkgJsonPath))
                {
                    const pkgJsonContent: unknown = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
                    if (typeof pkgJsonContent === 'object' && pkgJsonContent !== null && 'name' in pkgJsonContent)
                    {
                        const pkgName = pkgJsonContent.name;
                        if (pkgName === nameOrDir || pkgName === `@fluffjs/${nameOrDir}`)
                        {
                            if (fs.existsSync(path.join(projectPath, 'fluff.json')))
                            {
                                return projectPath;
                            }
                        }
                    }
                }
            }
        }

        return null;
    }

    private init(args: string[]): void
    {
        const [targetName] = args;
        const configPath = this.getConfigPath();

        let config: FluffConfig = { ...DEFAULT_CONFIG };

        if (fs.existsSync(configPath))
        {
            if (targetName)
            {
                config = this.loadConfig();
                if (config.targets[targetName])
                {
                    console.error(`Target '${targetName}' already exists in fluff.json`);
                    process.exit(1);
                }
                config.targets[targetName] = {
                    name: targetName,
                    srcDir: `src/${targetName}`,
                    outDir: `dist/${targetName}`,
                    components: ['**/*.component.ts'],
                    assets: ['**/*.html', '**/*.css']
                };
                console.log(`Added target '${targetName}' to fluff.json`);
            }
            else
            {
                console.error('fluff.json already exists. Use "fluff init <target>" to add a new target.');
                process.exit(1);
            }
        }
        else
        {
            config = { ...DEFAULT_CONFIG };
            if (targetName)
            {
                config.targets = {
                    [targetName]: {
                        name: targetName,
                        srcDir: 'src',
                        outDir: 'dist',
                        components: ['**/*.component.ts'],
                        assets: ['**/*.html', '**/*.css']
                    }
                };
                config.defaultTarget = targetName;
            }
            console.log('Created fluff.json');
        }

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`Configuration saved to ${configPath}`);
    }

    private async build(args: string[]): Promise<void>
    {
        let targetOrProject: string | undefined = args[0];
        let projectRoot = this.getProjectRoot();
        let workspaceRoot: string | null = null;
        let projectRelativePath: string | null = null;

        const nxJsonPath = this.findNxJson(this.cwd);
        if (nxJsonPath && targetOrProject)
        {
            workspaceRoot = path.dirname(nxJsonPath);
            const resolvedProject = this.tryResolveNxProject(targetOrProject, workspaceRoot);
            if (resolvedProject)
            {
                projectRoot = resolvedProject;
                projectRelativePath = path.relative(workspaceRoot, resolvedProject);
                targetOrProject = undefined;
            }
        }

        const configPath = path.join(projectRoot, 'fluff.json');
        if (!fs.existsSync(configPath))
        {
            throw new Error(`fluff.json not found at ${configPath}. Run 'fluff init' first.`);
        }

        const config = this.loadConfigFrom(configPath);

        let targets: FluffTarget[] = [];

        if (targetOrProject)
        {
            const target = config.targets[targetOrProject];
            if (!target)
            {
                console.error(`Target '${targetOrProject}' not found in fluff.json`);
                console.error(`Available targets: ${Object.keys(config.targets)
                    .join(', ')}`);
                process.exit(1);
            }
            targets = [target];
        }
        else if (config.defaultTarget)
        {
            const target = config.targets[config.defaultTarget];
            if (!target)
            {
                console.error(`Default target '${config.defaultTarget}' not found in fluff.json`);
                process.exit(1);
            }
            targets = [target];
        }
        else
        {
            targets = Object.values(config.targets);
        }

        for (const target of targets)
        {
            await this.buildTarget(target, projectRoot, workspaceRoot, projectRelativePath);
        }
    }

    private async buildTarget(
        target: FluffTarget,
        projectRoot: string,
        workspaceRoot: string | null,
        projectRelativePath: string | null
    ): Promise<void>
    {
        console.log(`🔨 Building target '${target.name}'...`);

        const srcDir = path.resolve(projectRoot, target.srcDir);
        const appDir = path.join(srcDir, 'app');

        const outDir = (workspaceRoot && projectRelativePath)
            ? path.join(workspaceRoot, 'dist', projectRelativePath)
            : path.resolve(projectRoot, target.outDir);

        if (!fs.existsSync(srcDir))
        {
            throw new Error(`Source directory not found: ${srcDir}`);
        }

        if (!fs.existsSync(outDir))
        {
            fs.mkdirSync(outDir, { recursive: true });
        }

        const bundleOptions = target.bundle ?? {};
        const entryPoint = target.entryPoint
            ? path.join(srcDir, target.entryPoint)
            : await this.generateEntryPoint(srcDir, target.components);

        console.log('   Building with esbuild...');

        const result = await esbuild.build({
            entryPoints: [entryPoint],
            bundle: true,
            outdir: outDir,
            format: 'esm',
            platform: 'browser',
            target: bundleOptions.target ?? 'es2022',
            minify: bundleOptions.minify ?? true,
            splitting: bundleOptions.splitting ?? false,
            treeShaking: true,
            metafile: true,
            plugins: [fluffPlugin({ srcDir: appDir, minify: bundleOptions.minify ?? true })],
            external: bundleOptions.external ?? [],
            logLevel: 'warning',
            tsconfigRaw: '{}'
        });

        const outputs = Object.keys(result.metafile?.outputs ?? {});
        const jsBundle = outputs.find(f => f.endsWith('.js'));
        const cssBundle = outputs.find(f => f.endsWith('.css'));

        if (jsBundle)
        {
            const jsBundleName = path.basename(jsBundle);
            const jsPath = path.join(outDir, jsBundleName);

            if (bundleOptions.gzip)
            {
                const jsContent = fs.readFileSync(jsPath);
                const gzipped = gzipSync(jsContent, { level: 9 });
                fs.writeFileSync(`${jsPath}.gz`, gzipped);
                fs.unlinkSync(jsPath);
                console.log(`   ✓ Created ${jsBundleName}.gz (${gzipped.length} bytes)`);
            }
            else
            {
                console.log(`   ✓ Created ${jsBundleName}`);
            }
        }

        if (cssBundle)
        {
            const cssBundleName = path.basename(cssBundle);
            const cssPath = path.join(outDir, cssBundleName);

            if (bundleOptions.gzip)
            {
                const cssContent = fs.readFileSync(cssPath);
                const gzipped = gzipSync(cssContent, { level: 9 });
                fs.writeFileSync(`${cssPath}.gz`, gzipped);
                fs.unlinkSync(cssPath);
                console.log(`   ✓ Created ${cssBundleName}.gz (${gzipped.length} bytes)`);
            }
            else
            {
                console.log(`   ✓ Created ${cssBundleName}`);
            }
        }

        if (target.indexHtml)
        {
            const indexHtmlPath = path.join(srcDir, target.indexHtml);
            if (fs.existsSync(indexHtmlPath))
            {
                const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
                const transformed = await transformIndexHtml(indexHtml, {
                    jsBundle: jsBundle ? path.basename(jsBundle) : 'main.js',
                    cssBundle: cssBundle ? path.basename(cssBundle) : undefined,
                    gzip: bundleOptions.gzip,
                    minify: bundleOptions.minify
                });
                fs.writeFileSync(path.join(outDir, 'index.html'), transformed);
                console.log('   ✓ Transformed index.html');
            }
        }

        if (target.assets)
        {
            const compiler = new ComponentCompiler();
            const assetFiles = this.findFiles(srcDir, target.assets);
            for (const filePath of assetFiles)
            {
                if (filePath.endsWith('.component.ts')) continue;
                if (filePath.endsWith('.component.html')) continue;
                if (filePath.endsWith('.component.css')) continue;
                if (target.indexHtml && filePath.endsWith(target.indexHtml)) continue;

                const relativePath = path.relative(srcDir, filePath);
                const outPath = path.join(outDir, relativePath);

                const outFileDir = path.dirname(outPath);
                if (!fs.existsSync(outFileDir))
                {
                    fs.mkdirSync(outFileDir, { recursive: true });
                }

                if (filePath.endsWith('.ts'))
                {
                    let content = fs.readFileSync(filePath, 'utf-8');
                    content = await compiler.stripTypeScript(content, filePath);
                    fs.writeFileSync(outPath.replace('.ts', '.js'), content);
                    console.log(`   ✓ Processed ${relativePath}`);
                }
                else
                {
                    fs.copyFileSync(filePath, outPath);
                    console.log(`   ✓ Copied ${relativePath}`);
                }
            }
        }

        console.log(`✅ Target '${target.name}' built successfully!`);
    }

    private async serve(args: string[]): Promise<void>
    {
        let targetOrProject: string | undefined = args[0];
        let projectRoot = this.getProjectRoot();
        let workspaceRoot: string | null = null;
        let projectRelativePath: string | null = null;

        const nxJsonPath = this.findNxJson(this.cwd);
        if (nxJsonPath && targetOrProject)
        {
            workspaceRoot = path.dirname(nxJsonPath);
            const resolvedProject = this.tryResolveNxProject(targetOrProject, workspaceRoot);
            if (resolvedProject)
            {
                projectRoot = resolvedProject;
                projectRelativePath = path.relative(workspaceRoot, resolvedProject);
                targetOrProject = undefined;
            }
        }

        const configPath = path.join(projectRoot, 'fluff.json');
        if (!fs.existsSync(configPath))
        {
            throw new Error(`fluff.json not found at ${configPath}. Run 'fluff init' first.`);
        }

        const config = this.loadConfigFrom(configPath);

        let target: FluffTarget;

        if (targetOrProject)
        {
            const t = config.targets[targetOrProject];
            if (!t)
            {
                console.error(`Target '${targetOrProject}' not found in fluff.json`);
                process.exit(1);
            }
            target = t;
        }
        else if (config.defaultTarget)
        {
            const t = config.targets[config.defaultTarget];
            if (!t)
            {
                console.error(`Default target '${config.defaultTarget}' not found in fluff.json`);
                process.exit(1);
            }
            target = t;
        }
        else
        {
            target = Object.values(config.targets)[0];
            if (!target)
            {
                console.error('No targets found in fluff.json');
                process.exit(1);
            }
        }

        await this.serveTarget(target, projectRoot, workspaceRoot, projectRelativePath);
    }

    private async serveTarget(
        target: FluffTarget,
        projectRoot: string,
        workspaceRoot: string | null,
        projectRelativePath: string | null
    ): Promise<void>
    {
        const srcDir = path.resolve(projectRoot, target.srcDir);
        const appDir = path.join(srcDir, 'app');

        const outDir = (workspaceRoot && projectRelativePath)
            ? path.join(workspaceRoot, 'dist', projectRelativePath)
            : path.resolve(projectRoot, target.outDir);

        if (!fs.existsSync(outDir))
        {
            fs.mkdirSync(outDir, { recursive: true });
        }

        const serveOptions = target.serve ?? {};
        const port = serveOptions.port ?? 3000;
        const host = serveOptions.host ?? 'localhost';

        const entryPoint = target.entryPoint
            ? path.join(srcDir, target.entryPoint)
            : await this.generateEntryPoint(srcDir, target.components);

        if (target.indexHtml)
        {
            const indexHtmlPath = path.join(srcDir, target.indexHtml);
            if (fs.existsSync(indexHtmlPath))
            {
                const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
                const transformed = await transformIndexHtml(indexHtml, {
                    jsBundle: path.basename(entryPoint)
                        .replace('.ts', '.js'),
                    cssBundle: undefined,
                    gzip: false,
                    minify: false,
                    liveReload: true
                });
                fs.writeFileSync(path.join(outDir, 'index.html'), transformed);
            }
        }

        if (target.assets)
        {
            const assetFiles = this.findFiles(srcDir, target.assets);
            for (const filePath of assetFiles)
            {
                if (filePath.endsWith('.component.ts')) continue;
                if (filePath.endsWith('.component.html')) continue;
                if (filePath.endsWith('.component.css')) continue;
                if (target.indexHtml && filePath.endsWith(target.indexHtml)) continue;
                if (filePath.endsWith('.ts')) continue;

                const relativePath = path.relative(srcDir, filePath);
                const outPath = path.join(outDir, relativePath);

                const outFileDir = path.dirname(outPath);
                if (!fs.existsSync(outFileDir))
                {
                    fs.mkdirSync(outFileDir, { recursive: true });
                }

                fs.copyFileSync(filePath, outPath);
            }
        }

        console.log(`🚀 Starting dev server for '${target.name}'...`);

        const ctx = await esbuild.context({
            entryPoints: [entryPoint],
            bundle: true,
            outdir: outDir,
            format: 'esm',
            platform: 'browser',
            target: 'es2022',
            minify: false,
            treeShaking: true,
            sourcemap: true,
            plugins: [fluffPlugin({ srcDir: appDir, minify: false, sourcemap: true })],
            logLevel: 'info'
        });

        await ctx.watch();
        console.log('   Watching for changes...');

        const { hosts, port: actualPort } = await ctx.serve({
            servedir: outDir,
            port,
            host
        });

        console.log(`   Server running at http://${hosts[0]}:${actualPort}`);
        console.log('   Press Ctrl+C to stop\n');
    }

    private async generateEntryPoint(srcDir: string, componentPatterns: string[]): Promise<string>
    {
        const componentFiles = this.findFiles(srcDir, componentPatterns);
        const imports = componentFiles.map(f =>
        {
            const relativePath = './' + path.relative(srcDir, f)
                .replace(/\\/g, '/');
            return `import '${relativePath}';`;
        });

        const entryContent = imports.join('\n');
        const entryPath = path.join(srcDir, '__generated_entry.ts');
        fs.writeFileSync(entryPath, entryContent);
        return entryPath;
    }

    private findFiles(dir: string, patterns: string[]): string[]
    {
        const files: string[] = [];

        const walk = (currentDir: string): void =>
        {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });
            for (const entry of entries)
            {
                const fullPath = path.join(currentDir, entry.name);
                if (entry.isDirectory())
                {
                    walk(fullPath);
                }
                else if (entry.isFile())
                {
                    const relativePath = path.relative(dir, fullPath);
                    if (this.matchesPatterns(relativePath, patterns))
                    {
                        files.push(fullPath);
                    }
                }
            }
        };

        walk(dir);
        return files;
    }

    private matchesPatterns(filePath: string, patterns: string[]): boolean
    {
        for (const pattern of patterns)
        {
            if (this.matchGlob(filePath, pattern))
            {
                return true;
            }
        }
        return false;
    }

    private matchGlob(filePath: string, pattern: string): boolean
    {
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '{{GLOBSTAR}}')
            .replace(/\*/g, '[^/]*')
            .replace(/\{\{GLOBSTAR}}\//g, '(.*\\/)?')
            .replace(/\{\{GLOBSTAR}}/g, '.*');

        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(filePath);
    }
}

export function parseArgs(argv: string[]): { options: CliOptions; args: string[] }
{
    const options: CliOptions = {};
    const args: string[] = [];

    let i = 0;
    while (i < argv.length)
    {
        const arg = argv[i];

        if (arg === '--nx' && argv[i + 1])
        {
            options.nxPackage = argv[i + 1];
            i += 2;
        }
        else if (arg === '--cwd' && argv[i + 1])
        {
            options.cwd = argv[i + 1];
            i += 2;
        }
        else if (arg?.startsWith('--'))
        {
            console.error(`Unknown option: ${arg}`);
            process.exit(1);
        }
        else if (arg)
        {
            args.push(arg);
            i++;
        }
        else
        {
            i++;
        }
    }

    return { options, args };
}
