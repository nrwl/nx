"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromisedBasedQueue = void 0;
class PromisedBasedQueue {
    constructor() {
        this.counter = 0;
        this.promise = Promise.resolve(null);
    }
    sendToQueue(fn) {
        this.counter++;
        let res, rej;
        const r = new Promise((_res, _rej) => {
            res = _res;
            rej = _rej;
        });
        this.promise = this.promise
            .then(async () => {
            try {
                res(await fn());
                this.counter--;
            }
            catch (e) {
                rej(e);
                this.counter--;
            }
        })
            .catch(async () => {
            try {
                res(await fn());
                this.counter--;
            }
            catch (e) {
                rej(e);
                this.counter--;
            }
        });
        return r;
    }
    isEmpty() {
        return this.counter === 0;
    }
}
exports.PromisedBasedQueue = PromisedBasedQueue;
