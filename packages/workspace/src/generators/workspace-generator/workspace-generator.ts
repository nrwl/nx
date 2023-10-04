import { Schema } from './schema';
import { Tree, stripIndents } from '@nx/devkit';

export default async function (host: Tree, schema: Schema) {
  const message = stripIndents`Workspace Generators are no longer supported. Instead,
    Nx now supports executing generators or executors from local plugins. To get 
    started, install @nx/plugin and run \`nx g plugin\`.

    Afterwards, or if you already have an Nx plugin, you can run 
    \`nx g generator --project {my-plugin}\` to add a new generator.
    
    For more information, see: https://nx.dev/deprecated/workspace-generators`;

  throw new Error(message);
}
