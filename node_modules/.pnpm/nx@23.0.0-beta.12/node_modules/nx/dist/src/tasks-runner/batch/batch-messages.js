"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchMessageType = void 0;
var BatchMessageType;
(function (BatchMessageType) {
    BatchMessageType[BatchMessageType["RunTasks"] = 0] = "RunTasks";
    BatchMessageType[BatchMessageType["CompleteTask"] = 1] = "CompleteTask";
    BatchMessageType[BatchMessageType["CompleteBatchExecution"] = 2] = "CompleteBatchExecution";
})(BatchMessageType || (exports.BatchMessageType = BatchMessageType = {}));
