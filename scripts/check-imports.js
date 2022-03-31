#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

function allFilesInDir(dirName) {
  let res = [];
  try {
    fs.readdirSync(dirName).forEach((c) => {
      const child = path.join(dirName, c);
      try {
        const s = fs.statSync(child);
        if (path.extname(child) === '.ts') {
          res.push({
            name: child,
            content: fs.readFileSync(child).toString(),
          });
        } else if (s.isDirectory()) {
          res = [...res, ...allFilesInDir(child)];
        }
      } catch (e) {}
    });
  } catch (e) {}
  return res;
}

function check() {
  const exceptions = [
    'packages/create-nx-workspace/bin/create-nx-workspaces.ts',
    'packages/create-nx-plugin/bin/create-nx-plugin.ts',
    'packages/workspace/src/command-line/affected.ts',
    'packages/workspace/src/command-line/report.ts',
    'packages/workspace/src/command-line/report.spec.ts',
    'packages/workspace/src/core/file-command-line-utils.ts',
    'packages/workspace/src/generators/preset/preset.ts',
    'packages/workspace/src/generators/init/init.ts',
    'packages/workspace/src/utils/update-task.ts',
    'packages/workspace/src/migrations/update-8-3-0/update-8-3-0.spec.ts',
    'packages/workspace/src/migrations/update-8-3-0/update-ng-cli-8-1.ts',
    'packages/workspace/src/migrations/update-8-12-0/update-package-json-deps.spec.ts',
    'packages/workspace/src/tasks-runner/task-orchestrator.ts',
    'packages/nest/src/generators/init/lib/add-dependencies.ts',
    'packages/nest/src/migrations/update-13-2-0/update-to-nest-8.ts',
  ];

  const files = [
    ...allFilesInDir('packages/create-nx-workspace'),
    ...allFilesInDir('packages/create-nx-plugin'),
    ...allFilesInDir('packages/cypress'),
    ...allFilesInDir('packages/express'),
    ...allFilesInDir('packages/jest'),
    ...allFilesInDir('packages/nest'),
    ...allFilesInDir('packages/node'),
    ...allFilesInDir('packages/react'),
    ...allFilesInDir('packages/web'),
    ...allFilesInDir('packages/workspace'),
  ];

  const invalidFiles = [];
  files.forEach((f) => {
    if (f.content.indexOf('@schematics/angular') > -1) {
      invalidFiles.push(f.name);
    }
    if (f.content.indexOf('@angular/') > -1) {
      invalidFiles.push(f.name);
    }
    if (f.content.indexOf("'@angular-devkit/build-angular';") > -1) {
      invalidFiles.push(f.name);
    }
    if (f.content.indexOf('@angular-devkit/build-angular/') > -1) {
      invalidFiles.push(f.name);
    }
  });

  return invalidFiles.filter((f) => !exceptions.includes(f));
}

const invalid = check();
if (invalid.length > 0) {
  console.error(
    'The following files import @schematics/angular or @angular/* or @angular-devkit/build-angular'
  );
  invalid.forEach((e) => console.log(e));
  process.exit(1);
} else {
  process.exit(0);
}
