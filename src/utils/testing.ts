import {Observable} from 'rxjs/Observable';
import {toPromise} from 'rxjs/operator/toPromise';
import {toArray} from 'rxjs/operator/toArray';

export function readAll<T>(o: Observable<T>): Promise<T[]> {
  return toPromise.call(toArray.call(o));
}
