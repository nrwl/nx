import type { PluginItem } from '@babel/core';
import * as babel from '@babel/core';
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as parse5 from 'parse5';
import { minify as minifyHtml } from 'html-minifier-terser';
import * as path from 'path';
import { SourceMapConsumer, SourceMapGenerator } from 'source-map';
import type { ClassTransformOptions } from './babel-plugin-class-transform.js';
import classTransformPlugin from './babel-plugin-class-transform.js';
import type { ComponentMetadata } from './babel-plugin-component.js';
import componentPlugin, { componentMetadataMap } from './babel-plugin-component.js';
import type { ImportTransformOptions } from './babel-plugin-imports.js';
import importsPlugin from './babel-plugin-imports.js';
import reactivePlugin, { reactivePropertiesMap } from './babel-plugin-reactive.js';
import { generate } from './BabelHelpers.js';
import { CodeGenerator } from './CodeGenerator.js';
import { ErrorHelpers } from './ErrorHelpers.js';
import { GetterDependencyExtractor } from './GetterDependencyExtractor.js';
import { Parse5Helpers } from './Parse5Helpers.js';
import type { CompileResult } from './interfaces/CompileResult.js';
import { TemplateParser } from './TemplateParser.js';

interface BabelTransformOptions
{
    useTypeScriptPreset?: boolean;
    useDecoratorSyntax?: boolean;
    plugins: PluginItem[];
    errorContext: string;
}

export type { CompileResult } from './interfaces/CompileResult.js';

export class ComponentCompiler
{
    private readonly componentSelectors = new Set<string>();

    private getReactivePropsForFile(filePath: string): Set<string>
    {
        const direct = reactivePropertiesMap.get(filePath);
        if (direct)
        {
            return direct;
        }

        for (const [key, value] of reactivePropertiesMap.entries())
        {
            if (key === filePath || key.endsWith(filePath) || filePath.endsWith(key))
            {
                return value;
            }
        }

        return new Set<string>();
    }

    protected createTemplateParser(_filePath: string): TemplateParser
    {
        return new TemplateParser();
    }

    private async runBabelTransform(code: string, filePath: string, options: BabelTransformOptions): Promise<string>
    {
        try
        {
            const presets: PluginItem[] = options.useTypeScriptPreset
                ? [['@babel/preset-typescript', { isTSX: false, allExtensions: true }]]
                : [];

            const plugins: PluginItem[] = options.useDecoratorSyntax
                ? [['@babel/plugin-syntax-decorators', { version: '2023-11' }], ...options.plugins]
                : options.plugins;

            const parserOpts = options.useDecoratorSyntax
                ? { plugins: ['typescript', 'decorators'] as babel.ParserOptions['plugins'] }
                : options.useTypeScriptPreset
                    ? { plugins: ['typescript'] as babel.ParserOptions['plugins'] }
                    : undefined;

            const result = await babel.transformAsync(code, {
                filename: filePath,
                presets,
                plugins,
                parserOpts
            });

            return result?.code ?? code;
        }
        catch(e)
        {
            console.error(`${options.errorContext} in ${filePath}:`, ErrorHelpers.getErrorMessage(e));
            return code;
        }
    }

    public async discoverComponents(dir: string): Promise<void>
    {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries)
        {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory())
            {
                await this.discoverComponents(fullPath);
            }
            else if (entry.name.endsWith('.component.ts'))
            {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const metadata = await this.extractComponentMetadata(content, fullPath);
                if (metadata?.selector)
                {
                    this.componentSelectors.add(metadata.selector);
                }
            }
        }
    }

    public async compileComponentForBundle(filePath: string, minify?: boolean, sourcemap?: boolean, skipDefine?: boolean, production?: boolean): Promise<CompileResult>
    {
        let source = fs.readFileSync(filePath, 'utf-8');
        const componentDir = path.dirname(filePath);

        const parser = this.createTemplateParser(filePath);

        reactivePropertiesMap.delete(filePath);

        if (source.includes('@Reactive') || source.includes('@Input'))
        {
            source = await this.transformReactiveProperties(source, filePath, production);
        }

        const metadata = await this.extractComponentMetadata(source, filePath);
        if (!metadata)
        {
            return { code: source };
        }

        const { selector, templateUrl, template, styleUrl, styles: inlineStyles, className } = metadata;

        let templateHtml = '';
        let templatePath: string | null = null;
        if (templateUrl)
        {
            templatePath = path.resolve(componentDir, templateUrl);
            templateHtml = fs.readFileSync(templatePath, 'utf-8');
        }
        else if (template)
        {
            templateHtml = template;
        }
        else
        {
            return { code: source };
        }

        const stylePath = styleUrl ? path.resolve(componentDir, styleUrl) : null;

        let styles = '';
        if (stylePath && fs.existsSync(stylePath))
        {
            styles = fs.readFileSync(stylePath, 'utf-8');
        }
        else if (inlineStyles)
        {
            styles = inlineStyles;
        }

        if (minify && styles)
        {
            const cssResult = await esbuild.transform(styles, {
                loader: 'css', minify: true
            });
            styles = cssResult.code;
        }

        const reactiveProps = this.getReactivePropsForFile(filePath);
        const getterDepMap = GetterDependencyExtractor.extractGetterDependencyMap(source, reactiveProps);
        parser.setGetterDependencyMap(getterDepMap);

        const parsed = await parser.parse(templateHtml);
        parser.setGetterDependencyMap(new Map());
        const gen = new CodeGenerator(this.componentSelectors, selector);
        let generatedHtml = gen.generateHtml(parsed);

        if (minify)
        {
            const fragment = parse5.parseFragment(generatedHtml);
            Parse5Helpers.removeNonMarkerComments(fragment);
            generatedHtml = parse5.serialize(fragment);

            generatedHtml = await minifyHtml(generatedHtml, {
                collapseWhitespace: true,
                removeComments: false,
                removeRedundantAttributes: true,
                removeEmptyAttributes: true
            });
        }

        const markerConfigJson = gen.getMarkerConfigJson();

        const renderMethod = gen.generateRenderMethodFromHtml(generatedHtml, styles, markerConfigJson);
        const bindingsSetup = gen.generateBindingsSetup();

        let result = await this.transformImportsForBundle(source, filePath);

        result = await this.transformClass(result, filePath, {
            className, originalSuperClass: 'HTMLElement', newSuperClass: 'FluffElement', injectMethods: [
                { name: '__render', body: renderMethod }, { name: '__setupBindings', body: bindingsSetup }
            ]
        });

        result = this.addFluffImport(result);

        const exprAssignments = gen.generateExpressionAssignments();
        if (exprAssignments)
        {
            result = this.appendCode(result, exprAssignments);
        }

        const bindingsMap = gen.getBindingsMap();
        if (Object.keys(bindingsMap).length > 0)
        {
            result = this.addBindingsMap(result, className, bindingsMap);
        }

        if (!skipDefine)
        {
            result = this.addCustomElementsDefine(result, selector, className);
        }

        const tsResult = await this.stripTypeScriptWithSourceMap(result, filePath, sourcemap);

        const watchFiles: string[] = [];
        if (templatePath)
        {
            watchFiles.push(templatePath);
        }
        if (stylePath && fs.existsSync(stylePath))
        {
            watchFiles.push(stylePath);
        }

        if (sourcemap && tsResult.map && templatePath)
        {
            const finalMap = await this.createComponentSourceMap(tsResult.code, tsResult.map, filePath, templatePath, stylePath);
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
            console.error(`Error transforming ${filePath}:`, ErrorHelpers.getErrorMessage(e));
            return { code };
        }
    }

    public async transformImportsForBundle(code: string, filePath: string): Promise<string>
    {
        const importOptions: ImportTransformOptions = {
            removeImportsFrom: ['lighter'],
            removeDecorators: ['Component', 'Input', 'Output'],
            pathReplacements: {},
            addJsExtension: false
        };

        return this.runBabelTransform(code, filePath, {
            useTypeScriptPreset: true,
            useDecoratorSyntax: true,
            plugins: [[importsPlugin, importOptions]],
            errorContext: 'Failed to transform imports'
        });
    }

    public async transformReactiveProperties(code: string, filePath = 'file.ts', production?: boolean): Promise<string>
    {
        return this.runBabelTransform(code, filePath, {
            useTypeScriptPreset: true,
            useDecoratorSyntax: true,
            plugins: [[reactivePlugin, { production: production ?? false }]],
            errorContext: 'Babel transform error'
        });
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
            console.error(`Error transforming ${filePath}:`, ErrorHelpers.getErrorMessage(e));
            return code;
        }
    }

    public async extractComponentMetadata(code: string, filePath: string): Promise<ComponentMetadata | null>
    {
        try
        {
            componentMetadataMap.delete(filePath);

            await this.runBabelTransform(code, filePath, {
                useTypeScriptPreset: true,
                useDecoratorSyntax: true,
                plugins: [componentPlugin],
                errorContext: 'Failed to extract component metadata'
            });

            return componentMetadataMap.get(filePath) ?? null;
        }
        catch(e)
        {
            console.error(`Failed to extract component metadata from ${filePath}:`, ErrorHelpers.getErrorMessage(e));
            return null;
        }
    }

    public async transformClass(code: string, filePath: string, options: ClassTransformOptions): Promise<string>
    {
        return this.runBabelTransform(code, filePath, {
            useTypeScriptPreset: false,
            useDecoratorSyntax: false,
            plugins: [[classTransformPlugin, options]],
            errorContext: 'Failed to transform class'
        });
    }

    public async transformLibraryImports(code: string, filePath: string): Promise<string>
    {
        const importOptions: ImportTransformOptions = {
            pathReplacements: {
                '@/fluff-lib/': '../'
            }, addJsExtension: true
        };

        return this.runBabelTransform(code, filePath, {
            useTypeScriptPreset: true,
            useDecoratorSyntax: false,
            plugins: [[importsPlugin, importOptions]],
            errorContext: 'Failed to transform library imports'
        });
    }

    private async createComponentSourceMap(code: string, esbuildMap: string, componentPath: string, templatePath: string, stylePath: string | null): Promise<string>
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

    private addFluffImport(code: string): string
    {
        const ast = parse(code, { sourceType: 'module' });

        const importSpecifiers = [
            t.importSpecifier(t.identifier('FluffBase'), t.identifier('FluffBase')),
            t.importSpecifier(t.identifier('FluffElement'), t.identifier('FluffElement')),
            t.importSpecifier(t.identifier('MarkerManager'), t.identifier('MarkerManager'))
        ];
        const importDecl = t.importDeclaration(importSpecifiers, t.stringLiteral('@fluffjs/fluff'));

        ast.program.body.unshift(importDecl);

        return generate(ast, { compact: false }).code;
    }

    private appendCode(code: string, additionalCode: string): string
    {
        const ast = parse(code, { sourceType: 'module' });
        const additionalAst = parse(additionalCode, { sourceType: 'module' });

        ast.program.body.push(...additionalAst.program.body);

        return generate(ast, { compact: false }).code;
    }

    private addBindingsMap(code: string, className: string, bindingsMap: Record<string, unknown>): string
    {
        const ast = parse(code, { sourceType: 'module' });

        const jsonStr = JSON.stringify(bindingsMap);
        const valueAst = parse(`(${jsonStr})`, { sourceType: 'module' });
        const [valueStmt] = valueAst.program.body;
        if (!t.isExpressionStatement(valueStmt))
        {
            return code;
        }

        const assignment = t.expressionStatement(
            t.assignmentExpression(
                '=',
                t.memberExpression(t.identifier(className), t.identifier('__bindings')),
                valueStmt.expression
            )
        );
        ast.program.body.push(assignment);

        return generate(ast, { compact: false }).code;
    }

    private addCustomElementsDefine(code: string, selector: string, className: string): string
    {
        const ast = parse(code, { sourceType: 'module' });

        const defineCall = t.expressionStatement(
            t.callExpression(
                t.memberExpression(t.identifier('customElements'), t.identifier('define')),
                [t.stringLiteral(selector), t.identifier(className)]
            )
        );
        ast.program.body.push(defineCall);

        return generate(ast, { compact: false }).code;
    }
}
