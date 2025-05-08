import { signalToCode } from './exit-codes';

const exitEvents = [
  'SIGINT',
  'SIGTERM',
  'SIGQUIT',
  'SIGHUP',
  'SIGKILL',
  'exit',
] as const;
type ExitEvent = (typeof exitEvents)[number];

const signalHandlers: Partial<
  Record<
    ExitEvent,
    Array<(signalOrCode: string | number) => void | Promise<void>>
  >
> = {};
const registeredHandlers = new Set<string>();

export function registerExitHandler(
  event: 'exit',
  cb: (code: number) => any | Promise<any>
);
export function registerExitHandler<T extends Omit<ExitEvent, 'exit'>>(
  event: T,
  cb: (signal: T) => any | Promise<any>
);
export function registerExitHandler<T extends ExitEvent>(
  event: T,
  cb: (signalOrCode: T extends Omit<ExitEvent, 'exit'> ? T : number) => void
) {
  signalHandlers[event] ??= [];
  if (registeredHandlers.has(event)) {
    return;
  }
  registerHandler(event);
}

function registerHandler(event: ExitEvent) {
  registeredHandlers.add(event);
  process.on(event, async (code?: number) => {
    for (const cb of signalHandlers[event]) {
      let next = cb(event === 'exit' ? code : event);
      if (next instanceof Promise) {
        await next;
      }
    }
    if (event === 'exit') {
      // process is already exiting, don't need to exit
    } else {
      process.exit(signalToCode(event));
    }
  });
}

for (const event of exitEvents) {
  registerHandler(event);
}
