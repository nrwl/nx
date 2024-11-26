import {
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  updateJson,
  type Tree,
} from '@nx/devkit';
import { updateAppEditorTsConfigExcludedFiles } from '../../utils/update-app-editor-tsconfig-excluded-files';
import type { NormalizedSchema } from './normalized-schema';

interface TsConfig {
  compilerOptions?: { types: string[] };
  exclude?: string[];
}

function getCompilerOptionsTypes(tsConfig: TsConfig): string[] {
  return tsConfig?.compilerOptions?.types ?? [];
}

export function updateEditorTsConfig(tree: Tree, options: NormalizedSchema) {
  const appTsConfig = readJson<TsConfig>(
    tree,
    joinPathFragments(options.appProjectRoot, 'tsconfig.app.json')
  );
  const types = getCompilerOptionsTypes(appTsConfig);

  if (types?.length) {
    updateJson(
      tree,
      joinPathFragments(options.appProjectRoot, 'tsconfig.editor.json'),
      (json) => {
        json.compilerOptions ??= {};
        json.compilerOptions.types = Array.from(new Set(types));
        return json;
      }
    );
  }

  const project = readProjectConfiguration(tree, options.name);
  updateAppEditorTsConfigExcludedFiles(tree, project);
}
