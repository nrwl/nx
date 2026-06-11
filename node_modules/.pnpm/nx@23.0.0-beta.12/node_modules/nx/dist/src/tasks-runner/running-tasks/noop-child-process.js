"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoopChildProcess = void 0;
class NoopChildProcess {
    constructor(results) {
        this.results = results;
    }
    send() { }
    async getResults() {
        return this.results;
    }
    kill() {
        return;
    }
    onExit(cb) {
        cb(this.results.code, this.results.terminalOutput);
    }
    onOutput(cb) {
        cb(this.results.terminalOutput);
    }
}
exports.NoopChildProcess = NoopChildProcess;
