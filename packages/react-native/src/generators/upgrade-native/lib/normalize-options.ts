import { names } from '@nrwl/devkit';
import { UpgradeNativeConfigureSchema } from '../schema';

export interface NormalizedSchema {
  name: string;
  displayName: string;
  className: string;
  lowerCaseName: string;
  entryFile: string;
  entryFileIos: string;
  e2eTestRunner: 'detox' | 'none';
}

export function normalizeOptions(
  options: UpgradeNativeConfigureSchema
): NormalizedSchema {
  const { fileName, className } = names(options.name);

  const entryFileIos = 'src/main';
  const entryFile = options.js ? 'src/main.js' : 'src/main.tsx';

  /**
   * if options.name is "my-app"
   * name: "my-app", className: 'MyApp', lowerCaseName: 'myapp', displayName: 'MyApp'
   * if options.name is "myApp"
   * name: "my-app", className: 'MyApp', lowerCaseName: 'myapp', displayName: 'MyApp'
   */
  return {
    name: fileName,
    className,
    lowerCaseName: className.toLowerCase(),
    displayName: options.displayName || className,
    entryFile,
    entryFileIos,
    e2eTestRunner: options.e2eTestRunner,
  };
}
