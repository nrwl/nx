import * as fs from 'fs-extra';
import * as path from 'path';
import { format, resolveConfig } from 'prettier';

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

export async function generateMarkdownFile(
  outputDirectory: string,
  templateObject: { name: string; template: string }
): Promise<void> {
  const filePath = path.join(outputDirectory, `${templateObject.name}.md`);
  fs.outputFileSync(
    filePath,
    await formatWithPrettier(filePath, templateObject.template)
  );
}

export async function generateJsonFile(
  filePath: string,
  json: unknown
): Promise<void> {
  fs.outputFileSync(
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

export function getNxPackageDependencies(
  packageJsonPath: string
): { name: string; dependencies: string[]; peerDependencies: string[] } {
  const packageJson = fs.readJsonSync(packageJsonPath);
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
