import { formatFiles, getProjects, Tree, updateJson } from '@nrwl/devkit';

export async function useReactJsxInTsconfig(host: Tree) {
  const projects = getProjects(host);

  projects.forEach((p) => {
    const tsConfigPath = `${p.root}/tsconfig.json`;

    if (host.exists(tsConfigPath)) {
      updateJson(host, tsConfigPath, (json) => {
        if (json.compilerOptions?.jsx === 'react') {
          // JSX is handled by babel
          json.compilerOptions.jsx = 'react-jsx';
        }
        return json;
      });
    }
  });

  await formatFiles(host);
}

export default useReactJsxInTsconfig;
