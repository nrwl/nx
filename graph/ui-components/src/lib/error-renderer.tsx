/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { GraphError } from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */
export function ErrorRenderer({ errors }: { errors: GraphError[] }) {
  return (
    <div>
      {errors.map((error, index) => {
        const errorHeading =
          error.pluginName && error.name
            ? `${error.name} - ${error.pluginName}`
            : error.name ?? error.message;
        const fileSpecifier =
          isCauseWithLocation(error.cause) && error.cause.errors.length === 1
            ? `${error.fileName}:${error.cause.errors[0].location.line}:${error.cause.errors[0].location.column}`
            : error.fileName;
        return (
          <div className="overflow-hidden pb-4">
            <span className="inline-flex max-w-full flex-col break-words font-bold font-normal text-gray-900 md:inline dark:text-slate-200">
              <span>{errorHeading}</span>
              {fileSpecifier && (
                <span className="hidden px-1 md:inline">-</span>
              )}
              <span>{fileSpecifier}</span>
            </span>
            <pre className="overflow-x-scroll pl-4 pt-3">
              {isCauseWithErrors(error.cause) &&
              error.cause.errors.length === 1 ? (
                <div>
                  {error.message} <br />
                  {error.cause.errors[0].text}{' '}
                </div>
              ) : (
                <div>{error.stack}</div>
              )}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

function isCauseWithLocation(cause: unknown): cause is {
  errors: {
    location: {
      column: number;
      line: number;
    };
    text: string;
  }[];
} {
  return (
    isCauseWithErrors(cause) &&
    (cause as any).errors[0].location &&
    (cause as any).errors[0].location.column &&
    (cause as any).errors[0].location.line
  );
}

function isCauseWithErrors(
  cause: unknown
): cause is { errors: { text: string }[] } {
  return cause && (cause as any).errors && (cause as any).errors[0].text;
}
