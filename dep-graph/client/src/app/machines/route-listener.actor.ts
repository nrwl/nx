import { InvokeCallback } from 'xstate';
import { DepGraphUIEvents } from './interfaces';
import { createBrowserHistory } from 'history';

function parseSearchParamsToEvents(searchParams: string): DepGraphUIEvents[] {
  const events: DepGraphUIEvents[] = [];
  const params = new URLSearchParams(searchParams);

  params.forEach((value, key) => {
    switch (key) {
      case 'select':
        if (value === 'all') {
          events.push({ type: 'selectAll' });
        } else if (value === 'affected') {
          events.push({ type: 'selectAffected' });
        }
        break;
      case 'focus':
        events.push({ type: 'focusProject', projectName: value });
        break;
      case 'groupByFolder':
        events.push({ type: 'setGroupByFolder', groupByFolder: true });
        break;
      case 'searchDepth':
        // events.push({
        //   type: 'setSearchDepthEnabled',
        //   searchDepthEnabled: true,
        // });
        events.push({
          type: 'setSearchDepth',
          searchDepth: parseInt(value),
        });
        break;
    }
  });
  return events;
}

export const routeListener: InvokeCallback<DepGraphUIEvents, DepGraphUIEvents> =
  (callback) => {
    const history = createBrowserHistory();

    parseSearchParamsToEvents(history.location.search).forEach((event) =>
      callback(event)
    );
  };
