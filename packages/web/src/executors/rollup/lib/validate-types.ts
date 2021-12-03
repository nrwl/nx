import { printDiagnostics, runTypeCheck } from '@nrwl/js';
import { join } from 'path';

export async function validateTypes(opts: {
  workspaceRoot: string;
  projectRoot: string;
  tsconfig: string;
}): Promise<void> {
  const ts = await import('typescript');
  const result = await runTypeCheck({
    ts,
    workspaceRoot: opts.workspaceRoot,
    tsConfigPath: join(opts.workspaceRoot, opts.tsconfig),
    mode: 'noEmit',
  });

  await printDiagnostics(result);

  if (result.errors.length > 0) {
    throw new Error('Found type errors. See above.');
  }
}
