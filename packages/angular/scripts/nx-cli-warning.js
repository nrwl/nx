const path = require('path');
const fs = require('fs');

try {
  const root = findWorkspaceRoot(process.cwd());
  if (path.basename(root) === 'workspace.json') {
    const workspaceJson = JSON.parse(fs.readFileSync(root));
    if (Object.keys(workspaceJson.projects).length === 0) {
      const output = require('@nrwl/workspace/src/utilities/output').output;
      output.warn({
        title: '@nrwl/angular added to a Nx workspace powered by the Nx CLI.',
        bodyLines: [
          "You won't be able to use 'ng' to generate artifacts and run tasks.",
          "If you want to use 'ng', you need to create a new workspace powered by the Angular CLI.",
          "You can do it by providing --cli when creating a new workspace as follows: 'create-nx-workspace --cli=angular'.",
          "You can invoke the Angular schematics with 'nx generate @nrwl/angular' to generate artifacts.",
        ],
      });
    }
  }
} catch (e) {}

function findWorkspaceRoot(dir) {
  if (path.dirname(dir) === dir) return null;
  if (exists(path.join(dir, 'angular.json'))) {
    return path.join(dir, 'angular.json');
  } else if (exists(path.join(dir, 'workspace.json'))) {
    return path.join(dir, 'workspace.json');
  } else {
    return findWorkspaceRoot(path.dirname(dir));
  }
}

function exists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}
