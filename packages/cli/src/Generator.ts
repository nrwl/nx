import * as t from '@babel/types';
import * as fs from 'fs';
import * as parse5 from 'parse5';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { generate } from './BabelHelpers.js';
import type { GeneratorOptions } from './interfaces/GeneratorOptions.js';
import { Parse5Helpers } from './Parse5Helpers.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class Generator
{
    public generate(options: GeneratorOptions): void
    {
        const { appName, outputDir } = options;

        const kebabName = this.toKebabCase(appName);
        const pascalName = this.toPascalCase(appName);
        const titleName = this.toTitleCase(appName);

        const appDir = path.join(outputDir, kebabName);

        if (fs.existsSync(appDir))
        {
            throw new Error(`Directory '${kebabName}' already exists`);
        }

        console.log(`🧸 Creating new Fluff app: ${kebabName}`);

        fs.mkdirSync(appDir, { recursive: true });
        fs.mkdirSync(path.join(appDir, 'src', 'app'), { recursive: true });

        this.writeFile(path.join(appDir, 'package.json'), this.getPackageJson(kebabName));
        this.writeFile(path.join(appDir, 'tsconfig.json'), this.getTsConfig());
        this.writeFile(path.join(appDir, 'fluff.json'), this.getFluffJson(kebabName));
        this.writeFile(path.join(appDir, 'src', 'index.html'), this.getIndexHtml(kebabName, titleName));
        this.writeFile(path.join(appDir, 'src', 'main.ts'), this.getMainTs(kebabName, pascalName));
        this.writeFile(path.join(appDir, 'src', 'app', `${kebabName}.component.ts`), this.getComponentTs(kebabName, pascalName));
        this.writeFile(path.join(appDir, 'src', 'app', `${kebabName}.component.html`), this.getComponentHtml());
        this.writeFile(path.join(appDir, 'src', 'app', `${kebabName}.component.css`), this.getComponentCss());

        console.log('   ✓ Created package.json');
        console.log('   ✓ Created tsconfig.json');
        console.log('   ✓ Created fluff.json');
        console.log('   ✓ Created src/index.html');
        console.log('   ✓ Created src/main.ts');
        console.log(`   ✓ Created src/app/${kebabName}.component.ts`);
        console.log(`   ✓ Created src/app/${kebabName}.component.html`);
        console.log(`   ✓ Created src/app/${kebabName}.component.css`);
        console.log('');
        console.log('✅ App created successfully!');
        console.log('');
        console.log('Next steps:');
        console.log(`   cd ${kebabName}`);
        console.log('   npm install');
        console.log('   npx @fluffjs/cli serve');
    }

    private writeFile(filePath: string, content: string): void
    {
        if (fs.existsSync(filePath))
        {
            throw new Error(`File already exists: ${filePath}`);
        }
        fs.writeFileSync(filePath, content);
    }

    private toKebabCase(str: string): string
    {
        return str
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .replace(/[\s_]+/g, '-')
            .toLowerCase();
    }

    private toPascalCase(str: string): string
    {
        return str
            .split(/[-_\s]+/)
            .map(word => word.charAt(0)
                .toUpperCase() + word.slice(1)
                .toLowerCase())
            .join('');
    }

    private toTitleCase(str: string): string
    {
        return str
            .split(/[-_\s]+/)
            .map(word => word.charAt(0)
                .toUpperCase() + word.slice(1)
                .toLowerCase())
            .join(' ');
    }

    private getPackageJson(name: string): string
    {
        const cliVersion = this.getCliVersion();
        return JSON.stringify({
            name,
            version: '0.0.1',
            private: true,
            type: 'module',
            scripts: {
                build: 'npx @fluffjs/cli build',
                serve: 'npx @fluffjs/cli serve'
            },
            dependencies: {
                '@fluffjs/fluff': `^${cliVersion}`
            },
            devDependencies: {
                '@fluffjs/cli': `^${cliVersion}`,
                typescript: '^5.0.0'
            }
        }, null, 2) + '\n';
    }

    private getCliVersion(): string
    {
        const pkgPath = path.join(__dirname, 'package.json');
        if (fs.existsSync(pkgPath))
        {
            const pkg: unknown = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            if (typeof pkg === 'object' && pkg !== null && 'version' in pkg && typeof pkg.version === 'string')
            {
                return pkg.version;
            }
        }
        return '0.0.1';
    }

    private getTsConfig(): string
    {
        return JSON.stringify({
            compilerOptions: {
                target: 'ES2022',
                module: 'ES2022',
                moduleResolution: 'bundler',
                experimentalDecorators: true,
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
                outDir: './dist',
                rootDir: './src',
                lib: ['ES2022', 'DOM', 'DOM.Iterable']
            },
            include: ['src/**/*.ts'],
            exclude: ['node_modules', 'dist']
        }, null, 2) + '\n';
    }

    private getFluffJson(name: string): string
    {
        return JSON.stringify({
            version: '1.0',
            targets: {
                app: {
                    name,
                    srcDir: 'src',
                    outDir: 'dist',
                    entryPoint: 'main.ts',
                    indexHtml: 'index.html',
                    components: ['**/*.component.ts'],
                    assets: [],
                    bundle: {
                        minify: true,
                        gzip: false,
                        target: 'es2022'
                    },
                    serve: {
                        port: 3000,
                        host: 'localhost'
                    }
                }
            },
            defaultTarget: 'app'
        }, null, 2) + '\n';
    }

    private getIndexHtml(kebabName: string, titleName: string): string
    {
        const doc = Parse5Helpers.createDocument();
        const html = Parse5Helpers.createElement('html', [{ name: 'lang', value: 'en' }]);
        const head = Parse5Helpers.createElement('head', []);
        const body = Parse5Helpers.createElement('body', []);

        const charset = Parse5Helpers.createElement('meta', [{ name: 'charset', value: 'UTF-8' }]);
        const viewport = Parse5Helpers.createElement('meta', [
            { name: 'name', value: 'viewport' },
            { name: 'content', value: 'width=device-width, initial-scale=1.0' }
        ]);
        const title = Parse5Helpers.createElement('title', []);
        Parse5Helpers.appendText(title, `${titleName} - Fluff.js`);

        const style = Parse5Helpers.createElement('style', []);
        Parse5Helpers.appendText(style, `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            min-height: 100vh;
        }
    `);

        Parse5Helpers.appendChild(head, charset);
        Parse5Helpers.appendChild(head, viewport);
        Parse5Helpers.appendChild(head, title);
        Parse5Helpers.appendChild(head, style);

        const appElement = Parse5Helpers.createElement(kebabName, []);
        const script = Parse5Helpers.createElement('script', [
            { name: 'type', value: 'module' },
            { name: 'src', value: './main.js' }
        ]);

        Parse5Helpers.appendChild(body, appElement);
        Parse5Helpers.appendChild(body, script);

        Parse5Helpers.appendChild(html, head);
        Parse5Helpers.appendChild(html, body);

        doc.childNodes.push(html);
        html.parentNode = doc;

        return '<!DOCTYPE html>\n' + parse5.serialize(doc);
    }

    private getMainTs(kebabName: string, pascalName: string): string
    {
        const componentName = `${pascalName}Component`;
        const importPath = `./app/${kebabName}.component.js`;

        const importDecl = t.importDeclaration(
            [t.importSpecifier(t.identifier(componentName), t.identifier(componentName))],
            t.stringLiteral(importPath)
        );

        const defineCall = t.expressionStatement(
            t.callExpression(
                t.memberExpression(t.identifier('customElements'), t.identifier('define')),
                [t.stringLiteral(kebabName), t.identifier(componentName)]
            )
        );

        const program = t.program([importDecl, defineCall]);
        return generate(program, { compact: false }).code + '\n';
    }

    private getComponentTs(kebabName: string, pascalName: string): string
    {
        const componentName = `${pascalName}Component`;

        const importDecl = t.importDeclaration(
            [
                t.importSpecifier(t.identifier('Component'), t.identifier('Component')),
                t.importSpecifier(t.identifier('Reactive'), t.identifier('Reactive'))
            ],
            t.stringLiteral('@fluffjs/fluff')
        );

        const componentDecorator = t.decorator(
            t.callExpression(t.identifier('Component'), [
                t.objectExpression([
                    t.objectProperty(t.identifier('selector'), t.stringLiteral(kebabName)),
                    t.objectProperty(t.identifier('templateUrl'), t.stringLiteral(`./${kebabName}.component.html`)),
                    t.objectProperty(t.identifier('styleUrl'), t.stringLiteral(`./${kebabName}.component.css`))
                ])
            ])
        );

        const reactiveDecorator = t.decorator(t.callExpression(t.identifier('Reactive'), []));

        const nameProperty = t.classProperty(
            t.identifier('name'),
            t.stringLiteral('World')
        );
        nameProperty.decorators = [reactiveDecorator];

        const reactiveDecorator2 = t.decorator(t.callExpression(t.identifier('Reactive'), []));
        const countProperty = t.classProperty(
            t.identifier('count'),
            t.numericLiteral(0)
        );
        countProperty.decorators = [reactiveDecorator2];

        const incrementMethod = t.classMethod(
            'method',
            t.identifier('increment'),
            [],
            t.blockStatement([
                t.expressionStatement(
                    t.updateExpression('++', t.memberExpression(t.thisExpression(), t.identifier('count')))
                )
            ])
        );

        const classDecl = t.classDeclaration(
            t.identifier(componentName),
            t.identifier('HTMLElement'),
            t.classBody([nameProperty, countProperty, incrementMethod])
        );
        classDecl.decorators = [componentDecorator];

        const exportDecl = t.exportNamedDeclaration(classDecl, []);

        const program = t.program([importDecl, exportDecl]);
        return generate(program, { compact: false }).code + '\n';
    }

    private getComponentHtml(): string
    {
        const fragment = parse5.parseFragment('');

        const container = Parse5Helpers.createElement('div', [{ name: 'class', value: 'container' }]);
        const card = Parse5Helpers.createElement('div', [{ name: 'class', value: 'card' }]);

        const logo = Parse5Helpers.createElement('div', [{ name: 'class', value: 'logo' }]);
        Parse5Helpers.appendText(logo, '🧸');

        const h1 = Parse5Helpers.createElement('h1', []);
        Parse5Helpers.appendText(h1, 'Hello, ');
        const highlight = Parse5Helpers.createElement('span', [{ name: 'class', value: 'highlight' }]);
        Parse5Helpers.appendText(highlight, '{{ name }}');
        Parse5Helpers.appendChild(h1, highlight);
        Parse5Helpers.appendText(h1, '!');

        const tagline = Parse5Helpers.createElement('p', [{ name: 'class', value: 'tagline' }]);
        Parse5Helpers.appendText(tagline, 'Welcome to Fluff.js');

        const inputGroup = Parse5Helpers.createElement('div', [{ name: 'class', value: 'input-group' }]);
        const label = Parse5Helpers.createElement('label', [{ name: 'for', value: 'name-input' }]);
        Parse5Helpers.appendText(label, 'What\'s your name?');
        const input = Parse5Helpers.createElement('input', [
            { name: 'id', value: 'name-input' },
            { name: 'type', value: 'text' },
            { name: '[value]', value: 'name' },
            { name: '(input)', value: 'name = $event.target.value' },
            { name: 'placeholder', value: 'Enter your name...' }
        ]);
        Parse5Helpers.appendChild(inputGroup, label);
        Parse5Helpers.appendChild(inputGroup, input);

        const counterSection = Parse5Helpers.createElement('div', [{ name: 'class', value: 'counter-section' }]);
        const counterP = Parse5Helpers.createElement('p', []);
        Parse5Helpers.appendText(counterP, 'You\'ve clicked ');
        const strong = Parse5Helpers.createElement('strong', []);
        Parse5Helpers.appendText(strong, '{{ count }}');
        Parse5Helpers.appendChild(counterP, strong);
        Parse5Helpers.appendText(counterP, ' times');
        const button = Parse5Helpers.createElement('button', [
            { name: 'class', value: 'btn' },
            { name: '(click)', value: 'increment()' }
        ]);
        Parse5Helpers.appendText(button, 'Click me! 🎉');
        Parse5Helpers.appendChild(counterSection, counterP);
        Parse5Helpers.appendChild(counterSection, button);

        const footer = Parse5Helpers.createElement('footer', []);
        const footerP = Parse5Helpers.createElement('p', []);
        Parse5Helpers.appendText(footerP, 'Built with Fluff.js — ');
        const em = Parse5Helpers.createElement('em', []);
        Parse5Helpers.appendText(em, '"Just the good stuff"');
        Parse5Helpers.appendChild(footerP, em);
        Parse5Helpers.appendChild(footer, footerP);

        Parse5Helpers.appendChild(card, logo);
        Parse5Helpers.appendChild(card, h1);
        Parse5Helpers.appendChild(card, tagline);
        Parse5Helpers.appendChild(card, inputGroup);
        Parse5Helpers.appendChild(card, counterSection);
        Parse5Helpers.appendChild(card, footer);
        Parse5Helpers.appendChild(container, card);

        fragment.childNodes.push(container);
        container.parentNode = fragment;

        return parse5.serialize(fragment) + '\n';
    }

    private getComponentCss(): string
    {
        return `:host {
    display: block;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
}

.container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 20px;
    box-sizing: border-box;
}

.card {
    background: white;
    border-radius: 20px;
    padding: 40px 50px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    text-align: center;
    max-width: 450px;
    width: 100%;
}

.logo {
    font-size: 4rem;
    margin-bottom: 10px;
}

h1 {
    margin: 0 0 8px 0;
    font-size: 2rem;
    color: #1a1a2e;
}

.highlight {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.tagline {
    color: #666;
    margin: 0 0 30px 0;
    font-size: 1.1rem;
}

.input-group {
    margin-bottom: 30px;
}

.input-group label {
    display: block;
    margin-bottom: 8px;
    color: #444;
    font-weight: 500;
}

.input-group input {
    width: 100%;
    padding: 12px 16px;
    font-size: 1rem;
    border: 2px solid #e0e0e0;
    border-radius: 10px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    box-sizing: border-box;
}

.input-group input:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

.counter-section {
    background: #f8f9fa;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 30px;
}

.counter-section p {
    margin: 0 0 15px 0;
    color: #444;
}

.counter-section strong {
    color: #667eea;
    font-size: 1.2em;
}

.btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 12px 30px;
    font-size: 1rem;
    font-weight: 600;
    border-radius: 10px;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}

.btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
}

.btn:active {
    transform: translateY(0);
}

footer {
    color: #999;
    font-size: 0.9rem;
}

footer p {
    margin: 0;
}

footer em {
    color: #764ba2;
}
`;
    }

}
