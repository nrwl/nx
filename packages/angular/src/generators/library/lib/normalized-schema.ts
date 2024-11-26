import { UnitTestRunner } from '../../../utils/test-runners';
import type { Linter, LinterType } from '@nx/eslint';

export interface NormalizedSchema {
  libraryOptions: {
    directory: string;
    name?: string;
    addTailwind?: boolean;
    skipFormat?: boolean;
    simpleName?: boolean;
    addModuleSpec?: boolean;
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
    linter: Linter | LinterType;
    unitTestRunner: UnitTestRunner;
    prefix: string;
    fileName: string;
    projectRoot: string;
    entryFile: string;
    modulePath: string;
    moduleName: string;
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
