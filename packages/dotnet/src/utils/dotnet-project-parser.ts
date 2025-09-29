import { readFileSync } from 'node:fs';
import { dirname, basename, parse } from 'node:path';

export interface ProjectInfo {
  targetFramework?: string;
  outputType?: string;
  packageReferences: string[];
  projectReferences: string[];
  isTestProject: boolean;
  isExecutable: boolean;
  projectType: 'csharp' | 'fsharp' | 'vb';
}

export function parseProjectFile(projectFilePath: string): ProjectInfo {
  const content = readFileSync(projectFilePath, 'utf-8');
  const packageReferences: string[] = [];
  const projectReferences: string[] = [];

  // Simple regex parsing for MSBuild project files
  const packageReferenceRegex = /<PackageReference\s+Include="([^"]+)"/g;
  const projectReferenceRegex = /<ProjectReference\s+Include="([^"]+)"/g;
  const targetFrameworkRegex = /<TargetFramework>([^<]+)<\/TargetFramework>/;
  const outputTypeRegex = /<OutputType>([^<]+)<\/OutputType>/;

  let match: RegExpExecArray | null;
  while ((match = packageReferenceRegex.exec(content)) !== null) {
    packageReferences.push(match[1]);
  }

  while ((match = projectReferenceRegex.exec(content)) !== null) {
    projectReferences.push(match[1]);
  }

  const targetFrameworkMatch = content.match(targetFrameworkRegex);
  const outputTypeMatch = content.match(outputTypeRegex);

  const targetFramework = targetFrameworkMatch?.[1];
  const outputType = outputTypeMatch?.[1];

  // Detect test projects by common test package references
  const testPackages = [
    'Microsoft.NET.Test.Sdk',
    'xunit',
    'xunit.runner.visualstudio',
    'MSTest.TestAdapter',
    'MSTest.TestFramework',
    'NUnit',
    'NUnit3TestAdapter',
  ];
  const isTestProject = packageReferences.some((pkg) =>
    testPackages.some((testPkg) => pkg.includes(testPkg))
  );

  const isExecutable =
    outputType?.toLowerCase() === 'exe' ||
    content.includes('<OutputType>Exe</OutputType>');

  // Determine project type from file extension
  const { ext } = parse(projectFilePath);
  let projectType: 'csharp' | 'fsharp' | 'vb';
  switch (ext) {
    case '.fsproj':
      projectType = 'fsharp';
      break;
    case '.vbproj':
      projectType = 'vb';
      break;
    default:
      projectType = 'csharp';
  }

  return {
    targetFramework,
    outputType,
    packageReferences,
    projectReferences,
    isTestProject,
    isExecutable,
    projectType,
  };
}

export function inferProjectName(configFilePath: string): string {
  const { name } = parse(configFilePath);

  // Convert PascalCase to kebab-case for regular project names
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function extractProjectNameFromFile(projectFileName: string): string {
  const { name } = parse(projectFileName);

  // Convert PascalCase to kebab-case for target names
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
