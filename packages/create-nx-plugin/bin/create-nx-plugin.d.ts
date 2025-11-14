#!/usr/bin/env node
import yargs = require('yargs');
import { CreateWorkspaceOptions } from 'create-nx-workspace';
import { NxCloud } from 'create-nx-workspace/src/utils/nx/nx-cloud';
import type { PackageManager } from 'create-nx-workspace/src/utils/package-manager';
export declare const yargsDecorator: {
  'Options:': string;
  'Examples:': string;
  boolean: string;
  count: string;
  string: string;
  array: string;
  required: string;
  'default:': string;
  'choices:': string;
  'aliases:': string;
};
interface CreateNxPluginArguments extends CreateWorkspaceOptions {
  pluginName: string;
  createPackageName?: string;
  packageManager: PackageManager;
  allPrompts: boolean;
  nxCloud: NxCloud;
}
export declare const commandsObject: yargs.Argv<CreateNxPluginArguments>;
export {};
//# sourceMappingURL=create-nx-plugin.d.ts.map
