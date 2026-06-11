"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAsyncIterator = isAsyncIterator;
exports.getLastValueFromAsyncIterableIterator = getLastValueFromAsyncIterableIterator;
function isAsyncIterator(v) {
    return typeof v?.[Symbol.asyncIterator] === 'function';
}
async function getLastValueFromAsyncIterableIterator(i) {
    let prev;
    let current;
    const generator = i[Symbol.asyncIterator] || i[Symbol.iterator];
    const iterator = generator.call(i);
    do {
        prev = current;
        current = await iterator.next();
    } while (!current.done);
    return current.value !== undefined || !prev ? current.value : prev.value;
}
