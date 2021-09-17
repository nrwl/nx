import { outputFileSync, readJsonSync } from 'fs-extra';
import { join } from 'path';
import { format, resolveConfig } from 'prettier';
const stripAnsi = require('strip-ansi');

export function sortAlphabeticallyFunction(a: string, b: string): number {
  const nameA = a.toUpperCase(); // ignore upper and lowercase
  const nameB = b.toUpperCase(); // ignore upper and lowercase
  if (nameA < nameB) {
    return -1;
  }
  if (nameA > nameB) {
    return 1;
  }
  // names must be equal
  return 0;
}

export function sortByBooleanFunction(a: boolean, b: boolean): number {
  if (a && !b) {
    return -1;
  }
  if (!a && b) {
    return 1;
  }
  return 0;
}

export async function generateMarkdownFile(
  outputDirectory: string,
  templateObject: { name: string; template: string }
): Promise<void> {
  const filePath = join(outputDirectory, `${templateObject.name}.md`);
  outputFileSync(
    filePath,
    await formatWithPrettier(filePath, stripAnsi(templateObject.template))
  );
}

export async function generateJsonFile(
  filePath: string,
  json: unknown
): Promise<void> {
  outputFileSync(
    filePath,
    await formatWithPrettier(filePath, JSON.stringify(json))
  );
}

export async function formatWithPrettier(filePath: string, content: string) {
  let options: any = {
    filepath: filePath,
  };
  const resolvedOptions = await resolveConfig(filePath);
  if (resolvedOptions) {
    options = {
      ...options,
      ...resolvedOptions,
    };
  }

  return format(content, options);
}

export function getNxPackageDependencies(packageJsonPath: string): {
  name: string;
  dependencies: string[];
  peerDependencies: string[];
} {
  const packageJson = readJsonSync(packageJsonPath);
  if (!packageJson) {
    console.log(`No package.json found at: ${packageJsonPath}`);
    return null;
  }
  return {
    name: packageJson.name,
    dependencies: packageJson.dependencies
      ? Object.keys(packageJson.dependencies).filter((item) =>
          item.includes('@nrwl')
        )
      : [],
    peerDependencies: packageJson.peerDependencies
      ? Object.keys(packageJson.peerDependencies).filter((item) =>
          item.includes('@nrwl')
        )
      : [],
  };
}

export function formatDeprecated(
  description: string,
  deprecated: boolean | string
) {
  if (!deprecated) {
    return description;
  }
  return deprecated === true
    ? `**Deprecated:** ${description}`
    : `
    **Deprecated:** ${deprecated}
    
    ${description}
    `;
}
