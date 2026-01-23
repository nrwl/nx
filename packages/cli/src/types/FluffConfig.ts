export interface BundleOptions
{
    minify?: boolean;
    splitting?: boolean;
    target?: string;
    gzip?: boolean;
    external?: string[];
}

export interface ServeOptions
{
    port?: number;
    host?: string;
}

export interface FluffTarget
{
    name: string;
    srcDir: string;
    outDir: string;
    entryPoint?: string;
    indexHtml?: string;
    components: string[];
    assets?: string[];
    bundle?: BundleOptions;
    serve?: ServeOptions;
}

export interface FluffConfig
{
    version: string;
    targets: Record<string, FluffTarget>;
    defaultTarget?: string;
}

export const DEFAULT_CONFIG: FluffConfig = {
    version: '1.0',
    targets: {
        app: {
            name: 'app',
            srcDir: 'src',
            outDir: 'dist',
            entryPoint: 'main.ts',
            indexHtml: 'index.html',
            components: ['**/*.component.ts'],
            assets: ['**/*.html', '**/*.css'],
            bundle: {
                minify: true,
                gzip: true,
                target: 'es2022'
            },
            serve: {
                port: 3000,
                host: 'localhost'
            }
        }
    },
    defaultTarget: 'app'
};
