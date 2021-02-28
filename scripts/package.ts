import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs-extra';

export function build(
  nxVersion,
  ngCliVersion,
  typescriptVersion,
  prettierVersion
) {
  try {
    execSync('npx nx run-many --target=build --all', {
      stdio: [0, 1, 2],
    });
  } catch {
    console.log('Build failed');
    process.exit(1);
  }

  const BUILD_DIR = 'build/packages';

  const files = [
    ...[
      'react',
      'next',
      'gatsby',
      'web',
      'jest',
      'node',
      'express',
      'nest',
      'cypress',
      'storybook',
      'angular',
      'workspace',
    ].map((f) => `${f}/src/utils/versions.js`),
    ...[
      'react',
      'next',
      'gatsby',
      'web',
      'jest',
      'node',
      'express',
      'nest',
      'cypress',
      'storybook',
      'angular',
      'workspace',
      'cli',
      'linter',
      'tao',
      'devkit',
      'eslint-plugin-nx',
      'create-nx-workspace',
      'create-nx-plugin',
      'nx-plugin',
    ].map((f) => `${f}/package.json`),
    'create-nx-workspace/bin/create-nx-workspace.js',
    'create-nx-plugin/bin/create-nx-plugin.js',
  ].map((f) => `${BUILD_DIR}/${f}`);

  files.forEach((f) => {
    let content = readFileSync(f).toString();
    content = content
      .replace(
        /exports.nxVersion = '\*'/g,
        `exports.nxVersion = '${nxVersion}'`
      )
      .replace(/NX_VERSION/g, nxVersion)
      .replace(/TYPESCRIPT_VERSION/g, typescriptVersion)
      .replace(/PRETTIER_VERSION/g, prettierVersion);

    writeFileSync(f, content);
  });
}
