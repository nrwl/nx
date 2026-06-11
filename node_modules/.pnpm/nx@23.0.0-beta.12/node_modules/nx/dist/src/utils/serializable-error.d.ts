/**
 * This function transforms an error into an object which can be properly serialized and deserialized to be sent between processes.
 */
export declare function createSerializableError<T extends Error>(error: T): T;
