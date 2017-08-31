import {Observable} from 'rxjs/Observable';
import {first} from 'rxjs/operator/first';
import {toArray} from 'rxjs/operator/toArray';
import {toPromise} from 'rxjs/operator/toPromise';

export function readAll<T>(o: Observable<T>): Promise<T[]> {
  return toPromise.call(toArray.call(o));
}

export function readFirst<T>(o: Observable<T>): Promise<T> {
  return toPromise.call(first.call(o));
}
