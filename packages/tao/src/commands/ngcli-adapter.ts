import { Architect } from '@angular-devkit/architect';
import { WorkspaceNodeModulesArchitectHost } from '@angular-devkit/architect/node';
import { json, JsonObject, schema, workspaces } from '@angular-devkit/core';
import { NodeJsSyncHost } from '@angular-devkit/core/node';
import { coerceTypes, convertAliases, Options, Schema } from '../shared/params';
import { printRunHelp, RunOptions } from '@nrwl/tao/src/commands/run';

function normalizeOptions(opts: Options, schema: Schema): Options {
  return convertAliases(coerceTypes(opts, schema), schema, false);
}

export async function run(logger: any, root: string, opts: RunOptions) {
  const fsHost = new NodeJsSyncHost();
  const { workspace } = await workspaces.readWorkspace(
    'workspace.json',
    workspaces.createWorkspaceHost(fsHost)
  );

  const registry = new json.schema.CoreSchemaRegistry();
  registry.addPostTransform(schema.transforms.addUndefinedDefaults);
  const architectHost = new WorkspaceNodeModulesArchitectHost(workspace, root);
  const architect = new Architect(architectHost, registry);

  const builderConf = await architectHost.getBuilderNameForTarget({
    project: opts.project,
    target: opts.target,
  });
  const builderDesc = await architectHost.resolveBuilder(builderConf);
  const flattenedSchema = await registry
    .flatten(builderDesc.optionSchema as json.JsonObject)
    .toPromise();

  if (opts.help) {
    printRunHelp(opts, flattenedSchema as Schema, logger);
    return 0;
  }

  const runOptions = normalizeOptions(
    opts.runOptions,
    flattenedSchema as Schema
  );
  const run = await architect.scheduleTarget(
    {
      project: opts.project,
      target: opts.target,
      configuration: opts.configuration,
    },
    runOptions as JsonObject,
    { logger }
  );
  const result = await run.output.toPromise();
  await run.stop();
  return result.success ? 0 : 1;
}
