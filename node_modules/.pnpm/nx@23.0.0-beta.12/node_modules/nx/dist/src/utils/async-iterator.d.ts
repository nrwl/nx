export declare function isAsyncIterator<T>(v: any): v is AsyncIterableIterator<T>;
export declare function getLastValueFromAsyncIterableIterator<T>(i: AsyncIterable<T> | AsyncIterableIterator<T>): Promise<T>;
