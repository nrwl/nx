interface FileWatcherChanges {
  fileChanges: { path: string; type: 'CREATE' | 'UPDATE' | 'DELETE' }[];
}

type SubscribeCallback = (changes: FileWatcherChanges) => Promise<void>;

export interface RegisteredFileWatcherNotifier {
  subscribe(callback: SubscribeCallback): void;
  notify(changes: FileWatcherChanges): any;
  unsubscribe(): any;
}

export function handleRegisterFileWatcher(): RegisteredFileWatcherNotifier {
  let subscriberCallback: SubscribeCallback | undefined;

  return {
    subscribe(callback) {
      subscriberCallback = callback;
    },
    async notify(changes: FileWatcherChanges) {
      subscriberCallback(changes);
    },
    unsubscribe() {
      // TODO(jcammisuli): unsubscribe from file watcher
    },
  };
}
