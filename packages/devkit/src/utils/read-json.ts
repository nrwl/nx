import { Tree } from '@nrwl/tao/src/shared/tree';
import * as stripJsonComments from 'strip-json-comments';

export function readJson<T = any>(host: Tree, path: string) {
  if (!host.exists(path)) {
    throw new Error(`Cannot find ${path}`);
  }
  const contents = stripJsonComments(host.read(path).toString('utf-8'));
  try {
    return JSON.parse(contents) as T;
  } catch (e) {
    throw new Error(`Cannot parse ${path}: ${e.message}`);
  }
}
