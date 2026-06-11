"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeTarget = serializeTarget;
function serializeTarget(project, target, configuration) {
    return [project, target, configuration].filter((part) => !!part).join(':');
}
