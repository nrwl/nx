import { Tree, formatFiles, installPackagesTask } from '@nrwl/devkit';
import { libraryGenerator } from '@nrwl/workspace/generators';

export default async function(host: Tree, schema: any) {
  await libraryGenerator(host, {name: schema.name});
  await formatFiles(host);
  return () => {
    installPackagesTask(host)
  }
}
