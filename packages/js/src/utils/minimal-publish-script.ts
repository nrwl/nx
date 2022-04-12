import type { Tree } from '@nrwl/devkit';

const publishScriptContent = `
/**
* This is a minimal script to publish your package to "npm".
* This is meant to be used as-is or customize as you see fit.
* 
* This script is executed on "dist/path/to/library" as "cwd" by default.
*
* You might need to authenticate with NPM before running this script.
*/

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import * as chalk from 'chalk';

// Executing publish script: node path/to/publish.mjs {name} --version {version} --tag {tag}
// Default "tag" to "next" so we won't publish the "latest" tag by accident.  
const [, , name, version, tag = 'next'] = process.argv;

// A simple SemVer validation to validate the version 
const validVersion = /^\\d+\\.\\d+\\.\\d(-\\w+\\.\\d+)?/;
if (!version || !validVersion.test(version)) {
  console.error(chalk.bold.red(\`No version provided or version did not match Semantic Versioning, expected: #.#.#-tag.# or #.#.#, got \${version}\`));
  process.exit(1);
}

// Updating the version in "package.json" before publishing
try {
  const json = JSON.parse(readFileSync(\`package.json\`).toString());
  json.version = version;
  writeFileSync(\`package.json\`, JSON.stringify(json, null, 2));
} catch (e) {
  console.error(chalk.bold.red(\`Error reading package.json file from library build output.\`))
}

// Execute "npm publish" to publish
execSync(\`npm publish --access public\`);
`;

export function addMinimalPublishScript(tree: Tree) {
  const publishScriptPath = 'tools/scripts/publish.mjs';

  if (!tree.exists(publishScriptPath)) {
    tree.write(publishScriptPath, publishScriptContent);
  }

  return publishScriptPath;
}
