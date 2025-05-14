import * as esbuild from 'esbuild';
import { writeFileSync, readFileSync } from 'fs';

const output = esbuild
  .transformSync(readFileSync('./src/code-block-button/js-module.ts'), {
    loader: 'ts',
    minify: true,
  })
  .code.replaceAll('\n', '\\n');

writeFileSync(
  './src/code-block-button/js-module.min.ts',
  `/**
 * GENERATED FILE - DO NOT EDIT
 * This JS module code was built from the source file "js-module.ts".
 * To change it, modify the source file and then re-run the build script.
 */

export default '${output}';
`
);
