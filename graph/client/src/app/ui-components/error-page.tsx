/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { ErrorRenderer } from '@nx/graph/ui-components';
import { GraphError } from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */

export type ErrorPageProps = {
  message: string | JSX.Element;
  stack?: string;
  errors: GraphError[];
};

export function ErrorPage({ message, stack, errors }: ErrorPageProps) {
  return (
    <div className="mx-auto mb-8 w-full max-w-6xl flex-grow px-8">
      <h1 className="mb-4 text-4xl dark:text-slate-100">Error</h1>
      <div>
        <ErrorWithStack message={message} stack={stack} />
      </div>
      {errors && (
        <div>
          <p className="text-md mb-4 dark:text-slate-200">
            Nx encountered the following issues while processing the project
            graph:{' '}
          </p>
          <div>
            <ErrorRenderer errors={errors} />
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorWithStack({
  message,
  stack,
}: {
  message: string | JSX.Element;
  stack?: string;
}) {
  return (
    <div>
      <p className="mb-4 text-lg dark:text-slate-100">{message}</p>
      {stack && <p className="text-sm">Error message: {stack}</p>}
    </div>
  );
}
