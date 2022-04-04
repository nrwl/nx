import { Tree } from '@nrwl/devkit';
import { Schema } from '../schema';

export function updateHostWithRemote(host: Tree, options: Schema) {
  // find the host project path
  // Update remotes inside ${host_path}/src/remotes.d.ts
  // Update remotes inside ${host_path}/mfe.config.js
}
