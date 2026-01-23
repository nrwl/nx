import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface GeneratorOptions
{
    appName: string;
    outputDir: string;
}

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
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    }

    private toTitleCase(str: string): string
    {
        return str
            .split(/[-_\s]+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
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
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${titleName} - Fluff.js</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            min-height: 100vh;
        }
    </style>
</head>
<body>
<${kebabName}></${kebabName}>
<script type="module" src="./main.js"></script>
</body>
</html>
`;
    }

    private getMainTs(kebabName: string, pascalName: string): string
    {
        return `import { ${pascalName}Component } from './app/${kebabName}.component.js';

customElements.define('${kebabName}', ${pascalName}Component);
`;
    }

    private getComponentTs(kebabName: string, pascalName: string): string
    {
        return `import { Component, Reactive } from '@fluffjs/fluff';

@Component({
    selector: '${kebabName}',
    templateUrl: './${kebabName}.component.html',
    styleUrl: './${kebabName}.component.css'
})
export class ${pascalName}Component extends HTMLElement
{
    @Reactive() public name = 'World';
    @Reactive() public count = 0;

    public increment(): void
    {
        this.count++;
    }
}
`;
    }

    private getComponentHtml(): string
    {
        return `<div class="container">
    <div class="card">
        <div class="logo">🧸</div>
        <h1>Hello, <span class="highlight">{{ name }}</span>!</h1>
        <p class="tagline">Welcome to Fluff.js</p>

        <div class="input-group">
            <label for="name-input">What's your name?</label>
            <input
                    id="name-input"
                    type="text"
                    [value]="name"
                    (input)="name = $event.target.value"
                    placeholder="Enter your name..."
            />
        </div>

        <div class="counter-section">
            <p>You've clicked <strong>{{ count }}</strong> times</p>
            <button class="btn" (click)="increment()">Click me! 🎉</button>
        </div>

        <footer>
            <p>Built with Fluff.js — <em>"Just the good stuff"</em></p>
        </footer>
    </div>
</div>
`;
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
