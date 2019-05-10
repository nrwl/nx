import * as fs from 'fs-extra';
import * as path from 'path';

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

export function generateFile(
  outputDirectory: string,
  templateObject: { name: string; template: string }
): void {
  fs.outputFileSync(
    path.join(outputDirectory, `${templateObject.name}.md`),
    templateObject.template
  );
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
      ? Object.keys(packageJson.dependencies).filter(item =>
          item.includes('@nrwl')
        )
      : [],
    peerDependencies: packageJson.peerDependencies
      ? Object.keys(packageJson.peerDependencies).filter(item =>
          item.includes('@nrwl')
        )
      : []
  };
}
