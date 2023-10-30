import { getProjects } from '../utils/project-configuration';
import { Tree } from '../../generators/tree';
import { joinPathFragments } from '../../utils/path';

export function updateDotenvFiles(
  host: Tree,
  cb: (contents: string, path: string) => string
) {
  for (const file of collectDotenvFiles(host)) {
    if (host.exists(file)) {
      host.write(file, cb(host.read(file).toString(), file));
    }
  }
}

function collectDotenvFiles(host: Tree) {
  const dotenvFiles = new Set<string>();
  dotenvFiles.add('.env');
  dotenvFiles.add('.env.local');
  dotenvFiles.add('.local.env');
  for (const project of getProjects(host).values()) {
    dotenvFiles.add(joinPathFragments(project.root, '.env'));
    dotenvFiles.add(joinPathFragments(project.root, '.env.local'));
    dotenvFiles.add(joinPathFragments(project.root, '.local.env'));
    for (const [targetName, target] of Object.entries(project.targets ?? {})) {
      dotenvFiles.add(joinPathFragments(project.root, `.env.${targetName}`));
      dotenvFiles.add(joinPathFragments(project.root, `.${targetName}.env`));
      dotenvFiles.add(`.env.${targetName}`);
      dotenvFiles.add(`.${targetName}.env`);

      for (const [configurationName, configuration] of Object.entries(
        target.configurations ?? {}
      )) {
        dotenvFiles.add(
          joinPathFragments(
            project.root,
            `.env.${targetName}.${configurationName}`
          )
        );
        dotenvFiles.add(
          joinPathFragments(
            project.root,
            `.${targetName}.${configurationName}.env`
          )
        );
        dotenvFiles.add(
          joinPathFragments(project.root, `.env.${configurationName}`)
        );
        dotenvFiles.add(
          joinPathFragments(project.root, `.${configurationName}.env`)
        );
        dotenvFiles.add(`.env.${targetName}.${configurationName}`);
        dotenvFiles.add(`.${targetName}.${configurationName}.env`);
        dotenvFiles.add(`.env.${configurationName}`);
        dotenvFiles.add(`.${configurationName}.env`);
      }
    }
  }
  return dotenvFiles;
}
