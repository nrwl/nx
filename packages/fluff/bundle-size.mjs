import * as esbuild from 'esbuild';
import { gzipSync } from 'zlib';
import fs from 'fs';

const result = await esbuild.build({
    entryPoints: ['./dist/index.js'],
    bundle: true,
    write: false,
    format: 'esm',
    target: 'es2022',
    minify: true,
    treeShaking: true,
});

const code = result.outputFiles[0].text;
const minifiedSize = Buffer.byteLength(code, 'utf8');
const gzippedSize = gzipSync(code).length;

console.log('=== Fluff Package Bundle Size ===');
console.log(`Minified:    ${(minifiedSize / 1024).toFixed(2)} KB (${minifiedSize} bytes)`);
console.log(`Gzipped:     ${(gzippedSize / 1024).toFixed(2)} KB (${gzippedSize} bytes)`);

fs.writeFileSync('./dist/bundle.min.js', code);
console.log('\nBundle written to dist/bundle.min.js');
