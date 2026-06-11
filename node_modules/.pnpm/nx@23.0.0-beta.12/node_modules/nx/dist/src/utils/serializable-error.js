"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSerializableError = createSerializableError;
/**
 * This function transforms an error into an object which can be properly serialized and deserialized to be sent between processes.
 */
function createSerializableError(error) {
    const res = {};
    Object.getOwnPropertyNames(error).forEach((k) => {
        let value = error[k];
        // If an error has an error as a property such as cause, it will be transformed into a serializable error
        if (typeof value === 'object' && value instanceof Error) {
            value = createSerializableError(value);
        }
        // If an error has an array of errors as a property, they will be transformed into serializable errors
        if (Array.isArray(value)) {
            value = value.map((v) => {
                if (typeof v === 'object' && v instanceof Error) {
                    return createSerializableError(v);
                    // Support for AggregateCreateNodesError
                }
                else if (Array.isArray(v) &&
                    v.length === 2 &&
                    v[1] instanceof Error) {
                    return [v[0], createSerializableError(v[1])];
                }
                return v;
            });
        }
        res[k] = value;
    });
    return res;
}
