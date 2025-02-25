import { join } from 'node:path';
import { Bench, Fn } from 'tinybench';
import { withCodSpeed } from '@codspeed/tinybench-plugin';

import { globWithWorkspaceContext } from 'nx/src/utils/workspace-context';
import { workspaceRoot } from '../../packages/nx/src/utils/workspace-root';

export function findAllBenchmarks(root: string) {
  return globWithWorkspaceContext(workspaceRoot, [
    join(root, '**', '*.benchmark.ts'),
  ]);
}

export async function runAllBenchmarks(root: string) {
  const bench = withCodSpeed(new Bench());

  const benchmarks = await findAllBenchmarks(root);

  for (const benchmarkFile of benchmarks) {
    const m = require(join('../../', benchmarkFile)) as {
      registerBenchmarks?: (bench: Bench) => void;
    };
    if (m.registerBenchmarks) {
      m.registerBenchmarks(bench);
    } else {
      throw new Error(`No benchmarks found in ${benchmarkFile}`);
    }
  }
  const results = await bench.run();
  console.table(bench.table());
  const errors = results.map((s) => s.result?.error).filter(Boolean);
  if (errors.length) {
    throw new AggregateError(errors);
  }
}

if (require.main === module) {
  const root = process.argv[2] || '.';
  runAllBenchmarks(root)
    .then(() => {
      console.log('All benchmarks completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error running benchmarks:', err);
      process.exit(1);
    });
}
