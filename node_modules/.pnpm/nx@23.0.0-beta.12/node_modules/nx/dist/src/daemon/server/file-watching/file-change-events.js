"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFileChangeListener = registerFileChangeListener;
exports.notifyFileChangeListeners = notifyFileChangeListeners;
const logger_1 = require("../../logger");
const fileChangeListeners = new Set();
function registerFileChangeListener(listener) {
    fileChangeListeners.add(listener);
}
function notifyFileChangeListeners(event) {
    for (const listener of fileChangeListeners) {
        try {
            listener(event);
        }
        catch (error) {
            logger_1.serverLogger.log('Error notifying file change listener:', error);
        }
    }
}
