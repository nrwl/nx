import * as babel from '@babel/core';
import * as esbuild from 'esbuild';
import * as fs from 'fs';
import { minify as minifyHtml } from 'html-minifier-terser';
import * as path from 'path';
import { SourceMapConsumer, SourceMapGenerator } from 'source-map';
import type { ClassTransformOptions } from './babel-plugin-class-transform.js';
import classTransformPlugin, { injectMethodBodies } from './babel-plugin-class-transform.js';
import type { ComponentMetadata } from './babel-plugin-component.js';
import componentPlugin, { componentMetadataMap } from './babel-plugin-component.js';
import type { ImportTransformOptions } from './babel-plugin-imports.js';
import importsPlugin from './babel-plugin-imports.js';
import reactivePlugin, { reactivePropertiesMap } from './babel-plugin-reactive.js';
import { CodeGenerator } from './CodeGenerator.js';
import { TemplateParser } from './TemplateParser.js';

export interface CompileResult
{
    code: string;
    map?: string;
    watchFiles?: string[];
}

export class ComponentCompiler
{
    private readonly componentSelectors = new Set<string>();
    private readonly parser: TemplateParser;
    private readonly generator: CodeGenerator;

    public constructor()
    {
        this.parser = new TemplateParser();
        this.generator = new CodeGenerator();
    }

    public registerComponent(selector: string): void
    {
        this.componentSelectors.add(selector);
    }

    public async discoverComponents(demoDir: string): Promise<void>
    {
        const files = fs.readdirSync(demoDir)
            .filter(f => f.endsWith('.component.ts'));
        for (const file of files)
        {
            const filePath = path.join(demoDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const metadata = await this.extractComponentMetadata(content, filePath);
            if (metadata?.selector)
            {
                this.componentSelectors.add(metadata.selector);
            }
        }
    }

    public async compileComponent(filePath: string): Promise<string>
    {
        let source = fs.readFileSync(filePath, 'utf-8');
        const componentDir = path.dirname(filePath);

        if (source.includes('@Reactive') || source.includes('@Input'))
        {
            source = await this.transformReactiveProperties(source, filePath);
            const reactiveProps = reactivePropertiesMap.get(filePath);
            if (reactiveProps)
            {
                this.generator.setReactiveProperties(reactiveProps);
            }
        }
        else
        {
            this.generator.setReactiveProperties(new Set());
        }

        const metadata = await this.extractComponentMetadata(source, filePath);
        if (!metadata)
        {
            return source;
        }

        const { selector, templateUrl, styleUrl, className } = metadata;

        const templatePath = path.resolve(componentDir, templateUrl);
        const templateHtml = fs.readFileSync(templatePath, 'utf-8');

        let styles = '';
        if (styleUrl)
        {
            const stylePath = path.resolve(componentDir, styleUrl);
            if (fs.existsSync(stylePath))
            {
                styles = fs.readFileSync(stylePath, 'utf-8');
            }
        }

        const { html, bindings, controlFlows, templateRefs } = this.parser.parse(templateHtml);

        this.generator.setTemplateRefs(templateRefs);

        const renderMethod = this.generator.generateRenderMethod(html, styles);

        const bindingsSetup = this.generator.generateBindingsSetup(bindings, controlFlows);

        let result = await this.transformImportsAndDecorators(source, filePath);

        result = await this.transformClass(result, filePath, {
            className, originalSuperClass: 'HTMLElement', newSuperClass: 'FluffElement', injectMethods: [
                { name: '__render', body: renderMethod }, { name: '__setupBindings', body: bindingsSetup }
            ]
        });

        result = 'import { FluffElement } from \'./fluff-lib/runtime/FluffElement.js\';\n' + result;

        result += `\ncustomElements.define('${selector}', ${className});\n`;

        result = await this.stripTypeScript(result, filePath);

        return result;
    }

    public async compileComponentForBundle(filePath: string, minify?: boolean, sourcemap?: boolean): Promise<CompileResult>
    {
        let source = fs.readFileSync(filePath, 'utf-8');
        const componentDir = path.dirname(filePath);
        const generator = new CodeGenerator();

        if (source.includes('@Reactive') || source.includes('@Input'))
        {
            source = await this.transformReactiveProperties(source, filePath);
            const reactiveProps = reactivePropertiesMap.get(filePath);
            if (reactiveProps)
            {
                generator.setReactiveProperties(reactiveProps);
            }
        }
        else
        {
            generator.setReactiveProperties(new Set());
        }

        const metadata = await this.extractComponentMetadata(source, filePath);
        if (!metadata)
        {
            return { code: source };
        }

        const { selector, templateUrl, styleUrl, className } = metadata;

        const templatePath = path.resolve(componentDir, templateUrl);
        let templateHtml = fs.readFileSync(templatePath, 'utf-8');
        const stylePath = styleUrl ? path.resolve(componentDir, styleUrl) : null;

        let styles = '';
        if (stylePath && fs.existsSync(stylePath))
        {
            styles = fs.readFileSync(stylePath, 'utf-8');
        }

        if (minify)
        {
            templateHtml = await minifyHtml(templateHtml, {
                collapseWhitespace: true,
                removeComments: true,
                removeRedundantAttributes: true,
                removeEmptyAttributes: true
            });

            if (styles)
            {
                const cssResult = await esbuild.transform(styles, {
                    loader: 'css',
                    minify: true
                });
                styles = cssResult.code;
            }
        }

        const { html, bindings, controlFlows, templateRefs } = this.parser.parse(templateHtml);

        generator.setTemplateRefs(templateRefs);

        const renderMethod = generator.generateRenderMethod(html, styles);
        const bindingsSetup = generator.generateBindingsSetup(bindings, controlFlows);

        let result = await this.transformImportsForBundle(source, filePath);

        result = await this.transformClass(result, filePath, {
            className, originalSuperClass: 'HTMLElement', newSuperClass: 'FluffElement', injectMethods: [
                { name: '__render', body: renderMethod }, { name: '__setupBindings', body: bindingsSetup }
            ]
        });

        result = 'import { FluffElement } from \'@fluffjs/fluff\';\n' + result;

        result += `\ncustomElements.define('${selector}', ${className});\n`;

        const tsResult = await this.stripTypeScriptWithSourceMap(result, filePath, sourcemap);

        const watchFiles = [templatePath];
        if (stylePath && fs.existsSync(stylePath))
        {
            watchFiles.push(stylePath);
        }

        if (sourcemap && tsResult.map)
        {
            const finalMap = await this.createComponentSourceMap(
                tsResult.code,
                tsResult.map,
                filePath,
                templatePath,
                stylePath
            );
            return { code: tsResult.code, map: finalMap, watchFiles };
        }

        return { code: tsResult.code, watchFiles };
    }

    public async stripTypeScriptWithSourceMap(code: string, filePath: string, sourcemap?: boolean): Promise<CompileResult>
    {
        try
        {
            const result = await esbuild.transform(code, {
                loader: 'ts',
                format: 'esm',
                target: 'es2022',
                sourcemap: sourcemap ? 'external' : false,
                sourcefile: filePath
            });
            return { code: result.code, map: result.map };
        }
        catch(e)
        {
            const message = e instanceof Error ? e.message : String(e);
            console.error(`Error transforming ${filePath}:`, message);
            return { code };
        }
    }

    private async createComponentSourceMap(
        code: string,
        esbuildMap: string,
        componentPath: string,
        templatePath: string,
        stylePath: string | null
    ): Promise<string>
    {
        const consumer = await new SourceMapConsumer(JSON.parse(esbuildMap));
        const generator = new SourceMapGenerator({
            file: path.basename(componentPath)
                .replace('.ts', '.js')
        });

        generator.setSourceContent(componentPath, fs.readFileSync(componentPath, 'utf-8'));
        generator.setSourceContent(templatePath, fs.readFileSync(templatePath, 'utf-8'));
        if (stylePath && fs.existsSync(stylePath))
        {
            generator.setSourceContent(stylePath, fs.readFileSync(stylePath, 'utf-8'));
        }

        consumer.eachMapping(mapping =>
        {
            if (mapping.source)
            {
                generator.addMapping({
                    generated: { line: mapping.generatedLine, column: mapping.generatedColumn },
                    original: { line: mapping.originalLine, column: mapping.originalColumn },
                    source: mapping.source,
                    name: mapping.name ?? undefined
                });
            }
        });

        consumer.destroy();
        return generator.toString();
    }

    public async transformImportsForBundle(code: string, filePath: string): Promise<string>
    {
        try
        {
            const importOptions: ImportTransformOptions = {
                removeImportsFrom: ['lighter'],
                removeDecorators: ['Component', 'Input', 'Output'],
                pathReplacements: {},
                addJsExtension: false
            };

            const result = await babel.transformAsync(code, {
                filename: filePath, presets: [
                    ['@babel/preset-typescript', { isTSX: false, allExtensions: true }]
                ], plugins: [
                    ['@babel/plugin-syntax-decorators', { version: '2023-11' }], [importsPlugin, importOptions]
                ], parserOpts: {
                    plugins: ['typescript', 'decorators']
                }
            });

            return result?.code ?? code;
        }
        catch(e)
        {
            const message = e instanceof Error ? e.message : String(e);
            console.error(`Failed to transform imports in ${filePath}:`, message);
            return code;
        }
    }

    public async transformReactiveProperties(code: string, filePath = 'file.ts'): Promise<string>
    {
        try
        {
            const result = await babel.transformAsync(code, {
                filename: filePath, presets: [
                    ['@babel/preset-typescript', { isTSX: false, allExtensions: true }]
                ], plugins: [
                    ['@babel/plugin-syntax-decorators', { version: '2023-11' }], reactivePlugin
                ], parserOpts: {
                    plugins: ['typescript', 'decorators']
                }
            });
            return result?.code ?? code;
        }
        catch(e)
        {
            const message = e instanceof Error ? e.message : String(e);
            console.error(`Babel transform error in ${filePath}:`, message);
            return code;
        }
    }

    public async stripTypeScript(code: string, filePath = 'file.ts'): Promise<string>
    {
        try
        {
            const result = await esbuild.transform(code, {
                loader: 'ts', format: 'esm', target: 'es2022',
            });
            return result.code;
        }
        catch(e)
        {
            const message = e instanceof Error ? e.message : String(e);
            console.error(`Error transforming ${filePath}:`, message);
            return code;
        }
    }

    public async extractComponentMetadata(code: string, filePath: string): Promise<ComponentMetadata | null>
    {
        try
        {
            componentMetadataMap.delete(filePath);

            await babel.transformAsync(code, {
                filename: filePath, presets: [
                    ['@babel/preset-typescript', { isTSX: false, allExtensions: true }]
                ], plugins: [
                    ['@babel/plugin-syntax-decorators', { version: '2023-11' }], componentPlugin
                ], parserOpts: {
                    plugins: ['typescript', 'decorators']
                }
            });

            return componentMetadataMap.get(filePath) ?? null;
        }
        catch(e)
        {
            const message = e instanceof Error ? e.message : String(e);
            console.error(`Failed to extract component metadata from ${filePath}:`, message);
            return null;
        }
    }

    public async transformImportsAndDecorators(code: string, filePath: string): Promise<string>
    {
        try
        {
            const importOptions: ImportTransformOptions = {
                removeImportsFrom: ['lighter'], removeDecorators: ['Component', 'Input', 'Output'], pathReplacements: {
                    '@/fluff-lib/': './fluff-lib/'
                }, addJsExtension: true
            };

            const result = await babel.transformAsync(code, {
                filename: filePath, presets: [
                    ['@babel/preset-typescript', { isTSX: false, allExtensions: true }]
                ], plugins: [
                    ['@babel/plugin-syntax-decorators', { version: '2023-11' }], [importsPlugin, importOptions]
                ], parserOpts: {
                    plugins: ['typescript', 'decorators']
                }
            });

            return result?.code ?? code;
        }
        catch(e)
        {
            const message = e instanceof Error ? e.message : String(e);
            console.error(`Failed to transform imports in ${filePath}:`, message);
            return code;
        }
    }

    public async transformClass(code: string, filePath: string, options: ClassTransformOptions): Promise<string>
    {
        try
        {
            const result = await babel.transformAsync(code, {
                filename: filePath, plugins: [
                    [classTransformPlugin, options]
                ]
            });

            let transformed = result?.code ?? code;

            if (options.injectMethods)
            {
                transformed = injectMethodBodies(transformed, options.injectMethods);
            }

            return transformed;
        }
        catch(e)
        {
            const message = e instanceof Error ? e.message : String(e);
            console.error(`Failed to transform class in ${filePath}:`, message);
            return code;
        }
    }

    public async transformLibraryImports(code: string, filePath: string): Promise<string>
    {
        try
        {
            const importOptions: ImportTransformOptions = {
                pathReplacements: {
                    '@/fluff-lib/': '../'
                }, addJsExtension: true
            };

            const result = await babel.transformAsync(code, {
                filename: filePath, presets: [
                    ['@babel/preset-typescript', { isTSX: false, allExtensions: true }]
                ], plugins: [
                    [importsPlugin, importOptions]
                ], parserOpts: {
                    plugins: ['typescript']
                }
            });

            return result?.code ?? code;
        }
        catch(e)
        {
            const message = e instanceof Error ? e.message : String(e);
            console.error(`Failed to transform library imports in ${filePath}:`, message);
            return code;
        }
    }

    public async copyLighterLib(srcDir: string, distDir: string): Promise<void>
    {
        const lighterLibSrc = path.join(srcDir, 'fluff-lib');
        const lighterLibDist = path.join(distDir, 'fluff-lib');

        if (!fs.existsSync(lighterLibDist))
        {
            fs.mkdirSync(lighterLibDist, { recursive: true });
        }

        const dirs = ['utils', 'runtime', 'interfaces', 'enums', 'decorators'];
        for (const dir of dirs)
        {
            const srcPath = path.join(lighterLibSrc, dir);
            const distPath = path.join(lighterLibDist, dir);

            if (fs.existsSync(srcPath))
            {
                if (!fs.existsSync(distPath))
                {
                    fs.mkdirSync(distPath, { recursive: true });
                }

                const files = fs.readdirSync(srcPath)
                    .filter(f => f.endsWith('.ts'));
                for (const file of files)
                {
                    const fullPath = path.join(srcPath, file);
                    let content = fs.readFileSync(fullPath, 'utf-8');

                    content = await this.transformLibraryImports(content, fullPath);

                    content = await this.stripTypeScript(content, fullPath);

                    const outFile = file.replace('.ts', '.js');
                    fs.writeFileSync(path.join(distPath, outFile), content);
                }
            }
        }
    }
}
