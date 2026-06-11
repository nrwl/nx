export declare class PromisedBasedQueue {
    private counter;
    private promise;
    sendToQueue(fn: () => Promise<any>): Promise<any>;
    isEmpty(): boolean;
}
