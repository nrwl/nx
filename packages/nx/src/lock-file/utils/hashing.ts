import { defaultHashing } from '../../hasher/hashing-impl';

// extends hashArray to not fail on non-string (undefined) values
export function hashValues(values: string[]): string {
  return defaultHashing.hashArray(values.filter((a) => !!a));
}
