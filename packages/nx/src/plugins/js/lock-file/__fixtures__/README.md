## Get packages' peer dependencies for NPM V1 mocks:

Renders only those packages that have peer dependencies.

```js
const readFileSync = require('fs').readFileSync;
const readdirSync = require('fs').readdirSync;
const existsSync = require('fs').existsSync;

let report = '';

const packageNames = [];

function processNodeModules(path = '.') {
  if (existsSync(`${path}/node_modules`)) {
    readdirSync(`${path}/node_modules`).forEach((folder) => {
      if (folder.startsWith('@')) {
        readdirSync(`${path}/node_modules/${folder}`).forEach((subfolder) => {
          packageNames.push(`${path}/node_modules/${folder}/${subfolder}`);
          processNodeModules(`${path}/node_modules/${folder}/${subfolder}`);
        });
      } else {
        packageNames.push(`${path}/node_modules/${folder}`);
        processNodeModules(`${path}/node_modules/${folder}`);
      }
    });
  }
}

processNodeModules();

packageNames.forEach((path) => {
  const filePath = `${path}/package.json`;
  if (existsSync(filePath)) {
    const content = readFileSync(filePath, 'utf-8');
    const peerDependencies = JSON.parse(content).peerDependencies;
    const peerDependenciesMeta = JSON.parse(content).peerDependenciesMeta;
    const output = JSON.stringify({
      ...(peerDependencies && { peerDependencies }),
      ...(peerDependenciesMeta && { peerDependenciesMeta }),
    });
    if (output === '{}') return;
    report += `'${filePath.slice(2)}': '${output}',\n`;
  }
});

console.log(report);
```

## Get packages' versions for Yarn and Pnpm mocks:

Renders only hoisted dependencies.

```js
const readFileSync = require('fs').readFileSync;
const readdirSync = require('fs').readdirSync;
const existsSync = require('fs').existsSync;

let report = '';

const packageNames = [];
readdirSync('node_modules').forEach((folder) => {
  if (folder === '.pnpm') return;
  if (folder.startsWith('@')) {
    readdirSync(`node_modules/${folder}`).forEach((subfolder) => {
      packageNames.push(`${folder}/${subfolder}`);
    });
  } else {
    packageNames.push(folder);
  }
});

packageNames.forEach((packageName) => {
  const path = `node_modules/${packageName}/package.json`;
  if (existsSync(path)) {
    const content = readFileSync(path, 'utf-8');
    const version = JSON.parse(content).version;
    report += `'${path}': '{"version": "${version}"}',\n`;
  }
});

console.log(report);
```
