import { WebContainer } from '@webcontainer/api';
import { useEffect } from 'react';

let webcontainerBooting = false;
let resolve!: (webcontainer: WebContainer) => void;

const webcontainerPromise = new Promise<WebContainer>((_resolve) => {
  resolve = _resolve;
});

export function useWebContainer() {
  useEffect(() => {
    if (!webcontainerBooting) {
      webcontainerBooting = true;

      WebContainer.boot({ workdirName: 'example' }).then((webcontainer) => {
        resolve(webcontainer);
      });
    }
  }, []);

  return webcontainerPromise;
}
