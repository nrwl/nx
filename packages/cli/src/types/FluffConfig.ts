import type { FluffConfig } from '../interfaces/FluffConfigInterface.js';

export type { BundleOptions } from '../interfaces/BundleOptions.js';
export type { FluffConfig } from '../interfaces/FluffConfigInterface.js';
export type { FluffTarget } from '../interfaces/FluffTarget.js';
export type { ServeOptions } from '../interfaces/ServeOptions.js';

export const DEFAULT_CONFIG: FluffConfig = {
    version: '1.0',
    targets: {
        app: {
            name: 'app',
            srcDir: 'src',
            outDir: 'dist',
            componentsDir: 'app',
            entryPoint: 'main.ts',
            indexHtml: 'index.html',
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
