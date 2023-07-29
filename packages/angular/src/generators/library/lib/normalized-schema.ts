import { UnitTestRunner } from '../../../utils/test-runners';
import type { Linter } from '@nx/linter';

export interface NormalizedSchema {
  libraryOptions: {
    name: string;
    addTailwind?: boolean;
    skipFormat?: boolean;
    simpleName?: boolean;
    addModuleSpec?: boolean;
    directory?: string;
    sourceDir?: string;
    buildable?: boolean;
    publishable?: boolean;
    importPath?: string;
    standaloneConfig?: boolean;
    spec?: boolean;
    commonModule?: boolean;
    routing?: boolean;
    lazy?: boolean;
    parent?: string;
    tags?: string;
    strict?: boolean;
    compilationMode?: 'full' | 'partial';
    setParserOptionsProject?: boolean;
    skipModule?: boolean;
    skipPackageJson?: boolean;
    skipPostInstall?: boolean;
    standalone?: boolean;
    linter: Linter;
    unitTestRunner: UnitTestRunner;
    prefix: string;
    fileName: string;
    projectRoot: string;
    entryFile: string;
    modulePath: string;
    moduleName: string;
    projectDirectory: string;
    parsedTags: string[];
    ngCliSchematicLibRoot: string;
    standaloneComponentName: string;
  };
  componentOptions: {
    name: string;
    standalone?: boolean;
    displayBlock?: boolean;
    inlineStyle?: boolean;
    inlineTemplate?: boolean;
    viewEncapsulation?: 'Emulated' | 'None' | 'ShadowDom';
    changeDetection?: 'Default' | 'OnPush';
    style?: 'css' | 'scss' | 'sass' | 'less' | 'none';
    skipTests?: boolean;
    selector?: string;
    skipSelector?: boolean;
    flat?: boolean;
  };
}
