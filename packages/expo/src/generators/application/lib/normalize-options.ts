import { names, Tree } from '@nrwl/devkit';
import { Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  className: string;
  projectName: string;
  appProjectRoot: string;
  lowerCaseName: string;
  parsedTags: string[];
}

export function normalizeOptions(options: Schema): NormalizedSchema {
  const { fileName, className } = names(options.name);

  const directoryName = options.directory
    ? names(options.directory).fileName
    : '';
  const projectDirectory = directoryName
    ? `${directoryName}/${fileName}`
    : fileName;

  const appProjectName = projectDirectory.replace(new RegExp('/', 'g'), '-');

  const appProjectRoot = `apps/${projectDirectory}`;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  /**
   * if options.name is "my-app"
   * name: "my-app", className: 'MyApp', lowerCaseName: 'myapp', displayName: 'MyApp', projectName: 'my-app', appProjectRoot: 'apps/my-app', androidProjectRoot: 'apps/my-app/android', iosProjectRoot: 'apps/my-app/ios'
   * if options.name is "myApp"
   * name: "my-app", className: 'MyApp', lowerCaseName: 'myapp', displayName: 'MyApp', projectName: 'my-app', appProjectRoot: 'apps/my-app', androidProjectRoot: 'apps/my-app/android', iosProjectRoot: 'apps/my-app/ios'
   */
  return {
    ...options,
    unitTestRunner: options.unitTestRunner || 'jest',
    e2eTestRunner: options.e2eTestRunner || 'detox',
    name: fileName,
    className,
    lowerCaseName: className.toLowerCase(),
    displayName: options.displayName || className,
    projectName: appProjectName,
    appProjectRoot,
    parsedTags,
  };
}
