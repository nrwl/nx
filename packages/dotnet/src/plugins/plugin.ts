import { createNodes as createDotNetNodes } from './create-nodes';
import { createDependencies as createDotNetDependencies } from './create-dependencies';

// The plugin can be fully disabled (e.g. to debug graph issues) via the
// NX_DOTNET_DISABLE environment variable. When disabled, no nodes or
// dependencies are created so Nx effectively ignores .NET projects.
const disabled = process.env.NX_DOTNET_DISABLE === 'true';

export const name = disabled ? '@nx/dotnet [disabled]' : '@nx/dotnet';

export const createNodes = disabled ? undefined : createDotNetNodes;

export const createNodesV2 = disabled ? undefined : createDotNetNodes;

export const createDependencies = disabled
  ? undefined
  : createDotNetDependencies;
