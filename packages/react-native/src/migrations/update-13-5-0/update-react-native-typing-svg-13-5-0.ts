import {
  Tree,
  formatFiles,
  getProjects,
  updateJson,
  offsetFromRoot,
  ProjectConfiguration,
} from '@nrwl/devkit';

/**
 * Update svg typings in tsconfig for react native app
 * Replace node_modules/@nrwl/react/typings/image.d.ts with node_modules/@nrwl/react-native/typings/svg.d.ts
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  projects.forEach((project) => {
    if (project.targets?.start?.executor !== '@nrwl/react-native:start') return;
    updateReactNativeSvgTypingInTsconfig(tree, project);
  });

  await formatFiles(tree);
}

function updateReactNativeSvgTypingInTsconfig(
  host: Tree,
  project: ProjectConfiguration
) {
  const tsconfigPath = `${project.root}/tsconfig.json`;
  if (!host.exists(tsconfigPath)) return;
  const offset = offsetFromRoot(project.root);
  updateJson(host, tsconfigPath, (json) => {
    const files = json.files || [];
    const imageTypingIndex = files.findIndex(
      (file) => file === `${offset}node_modules/@nrwl/react/typings/image.d.ts`
    );
    const reactNativeSvgTypingPath = `${offset}node_modules/@nrwl/react-native/typings/svg.d.ts`;
    if (imageTypingIndex === -1) {
      files.push(reactNativeSvgTypingPath);
    } else {
      files[imageTypingIndex] = reactNativeSvgTypingPath;
    }
    json.files = files;
    return json;
  });
}
