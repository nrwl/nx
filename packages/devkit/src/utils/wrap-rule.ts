import { Tree } from '@nrwl/tao/src/shared/tree';

export function wrapRule(callback: (...args) => any) {
  return (host: Tree) => {
    callback(host);
  };
}
