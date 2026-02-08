export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

export interface GeneratorOptions
{
    appName: string;
    outputDir: string;
    packageManager?: PackageManager;
    skipInstall?: boolean;
}
