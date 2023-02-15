import { ExecutorContext } from '@nrwl/devkit';
import { createCompiler } from '../../utils/create-compiler';
import { RspackExecutorSchema } from './schema';

export default async function runExecutor(
  options: RspackExecutorSchema,
  context: ExecutorContext
) {
  process.env.NODE_ENV ??= 'production';

  const compiler = await createCompiler(options, context);

  return new Promise<{ success: boolean }>((res) => {
    compiler.run(() => {
      compiler.close((err: any) => {
        res({ success: !err });
      });
    });
  });
}
