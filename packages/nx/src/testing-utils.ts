import {Observable} from 'rxjs/Observable';
import {toArray} from 'rxjs/operator/toArray';
import {toPromise} from 'rxjs/operator/toPromise';

export function readAll<T>(o: Observable<T>): Promise<T[]> {
  return toPromise.call(toArray.call(o));
}
