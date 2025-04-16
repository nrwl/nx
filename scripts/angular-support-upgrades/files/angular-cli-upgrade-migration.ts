export const getAngularCliMigrationGenerator = (
  version: string
) => `import { formatFiles, Tree, updateJson } from '@nx/devkit';

export const angularCliVersion = '~${version}';

export default async function (tree: Tree) {
  let shouldFormat = false;

  updateJson(tree, 'package.json', (json) => {
    if (json.devDependencies?.['@angular/cli']) {
      json.devDependencies['@angular/cli'] = angularCliVersion;
      shouldFormat = true;
    } else if (json.dependencies?.['@angular/cli']) {
      json.dependencies['@angular/cli'] = angularCliVersion;
      shouldFormat = true;
    }

    return json;
  });

  if (shouldFormat) {
    await formatFiles(tree);
  }
}
`;

export const getAngularCliMigrationGeneratorSpec =
  () => `import { readJson, Tree, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import updateAngularCli, { angularCliVersion } from './update-angular-cli';

describe('update-angular-cli migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should update @angular/cli version when defined as a dev dependency', async () => {
    writeJson(tree, 'package.json', {
      devDependencies: { '@angular/cli': '~13.3.0' },
    });

    await updateAngularCli(tree);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['@angular/cli']).toBe(angularCliVersion);
  });

  it('should update @angular/cli version when defined as a dependency', async () => {
    writeJson(tree, 'package.json', {
      dependencies: { '@angular/cli': '~13.3.0' },
    });

    await updateAngularCli(tree);

    const { dependencies } = readJson(tree, 'package.json');
    expect(dependencies['@angular/cli']).toBe(angularCliVersion);
  });

  it('should not add @angular/cli to package.json when it is not set', async () => {
    const initialPackageJson = readJson(tree, 'package.json');

    await updateAngularCli(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toStrictEqual(initialPackageJson);
  });
});
`;

export const getAngularCliMigrationDocs = (
  fromVersion: string,
  toVersion: string
) => `#### Sample Code Changes

Update the \`@angular/cli\` package version in the \`package.json\` file at the workspace root to **~${toVersion}**.

{% tabs %}
{% tab label="Before" %}

\`\`\`json {% fileName="package.json" %}
{
  "devDependencies": {
    "@angular/cli": "~${fromVersion}"
  }
}
\`\`\`

{% /tab %}
{% tab label="After" %}

\`\`\`json {% highlightLines=[3] fileName="package.json" %}
{
  "devDependencies": {
    "@angular/cli": "~${toVersion}"
  }
}
\`\`\`

{% /tab %}

{% /tabs %}
`;
