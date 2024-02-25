import {
  joinPathFragments,
  readJson,
  updateJson,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';

export function updateAppEditorTsConfigExcludedFiles(
  tree: Tree,
  projectConfig: ProjectConfiguration
) {
  if (projectConfig.projectType !== 'application') {
    return;
  }

  const editorTsConfigPath = joinPathFragments(
    projectConfig.root,
    'tsconfig.editor.json'
  );
  const appTsConfigPath = joinPathFragments(
    projectConfig.root,
    'tsconfig.app.json'
  );
  if (!tree.exists(editorTsConfigPath) || !tree.exists(appTsConfigPath)) {
    return;
  }

  const appTsConfig = readJson(tree, appTsConfigPath);
  updateJson(tree, editorTsConfigPath, (json) => {
    const exclude = [...(json.exclude ?? []), ...(appTsConfig.exclude ?? [])];
    if (exclude.length) {
      json.exclude = Array.from(new Set(exclude));
    }

    return json;
  });
}
