import * as chalk from 'chalk';
import * as yargs from 'yargs';
import { watch } from 'chokidar';
import { BehaviorSubject } from 'rxjs';
import { debounceTime, filter, switchMapTo, tap } from 'rxjs/operators';
import { execSync } from 'child_process';

/**
 * Available colours
 */
const { bgGreen, white } = chalk;

const argv = yargs
  .command('Usage: $0', 'Sync the public folder with the /docs folder one time')
  .example(
    '$0 --watch',
    'Sync the public folder with the /docs folder whenever changes are done'
  )
  .option('watch', {
    alias: 'w',
    demandOption: false,
    type: 'boolean',
    description: 'Enable the watch mode',
  }).argv;

function sync(): void {
  execSync(
    'rsync -avrR --delete ./docs/./ ./nx-dev/nx-dev/public/documentation'
  );
}

function main(isWatched: boolean) {
  if (isWatched) {
    const isReady$ = new BehaviorSubject(false);
    const syncR$ = new BehaviorSubject(null);

    /**
     * If we do not debounce, the sync will happen for every file detect by the watcher
     */
    isReady$
      .pipe(
        filter((isReady) => isReady),
        tap(() =>
          console.log(
            bgGreen(
              white(
                ' => DOCS SYNC ENABLED & READY: You can modify `/docs`, changes will be synced '
              )
            )
          )
        ),
        switchMapTo(syncR$),
        debounceTime(1000)
      )
      .subscribe(() => sync());

    return watch('./docs', {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      awaitWriteFinish: true,
    })
      .on('ready', () => isReady$.next(true))
      .on('add', (path) => syncR$.next(path))
      .on('addDir', (path) => syncR$.next(path))
      .on('change', (path) => syncR$.next(path))
      .on('unlink', (path) => syncR$.next(path));
  }

  return sync();
}

main(argv.watch as boolean);
