import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';

const assets = [
    ['executors.json', 'dist/executors.json'],
    ['generators.json', 'dist/generators.json'],
    ['src/executors/build/schema.json', 'dist/executors/build/schema.json'],
    ['src/executors/serve/schema.json', 'dist/executors/serve/schema.json'],
    ['src/generators/preset/schema.json', 'dist/generators/preset/schema.json'],
    ['src/generators/init/schema.json', 'dist/generators/init/schema.json'],
    ['src/generators/app/schema.json', 'dist/generators/app/schema.json']
];

for (const [src, dest] of assets)
{
    const destDir = dirname(dest);
    if (!existsSync(destDir))
    {
        mkdirSync(destDir, { recursive: true });
    }
    copyFileSync(src, dest);
    console.log(`Copied ${src} -> ${dest}`);
}
