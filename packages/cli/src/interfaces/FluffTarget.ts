import type { BundleOptions } from './BundleOptions.js';
import type { ServeOptions } from './ServeOptions.js';

export interface FluffTarget
{
    name: string;
    srcDir: string;
    outDir: string;
    entryPoint?: string;
    indexHtml?: string;
    components: string[];
    styles?: string[];
    assets?: string[];
    bundle?: BundleOptions;
    serve?: ServeOptions;
}
