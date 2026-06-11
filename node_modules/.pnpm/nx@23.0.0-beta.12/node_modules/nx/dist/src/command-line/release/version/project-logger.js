"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectLogger = void 0;
const tslib_1 = require("tslib");
const pc = tslib_1.__importStar(require("picocolors"));
const output_1 = require("../../../utils/output");
const colors = [
    { instance: pc.green, spinnerColor: 'green' },
    { instance: pc.greenBright, spinnerColor: 'green' },
    { instance: pc.red, spinnerColor: 'red' },
    { instance: pc.redBright, spinnerColor: 'red' },
    { instance: pc.cyan, spinnerColor: 'cyan' },
    { instance: pc.cyanBright, spinnerColor: 'cyan' },
    { instance: pc.yellow, spinnerColor: 'yellow' },
    { instance: pc.yellowBright, spinnerColor: 'yellow' },
    { instance: pc.magenta, spinnerColor: 'magenta' },
    { instance: pc.magentaBright, spinnerColor: 'magenta' },
];
function getColor(projectName) {
    let code = 0;
    for (let i = 0; i < projectName.length; ++i) {
        code += projectName.charCodeAt(i);
    }
    const colorIndex = code % colors.length;
    return colors[colorIndex];
}
class ProjectLogger {
    constructor(projectName) {
        this.projectName = projectName;
        this.logs = [];
        this.color = getColor(projectName);
    }
    buffer(msg) {
        this.logs.push(msg);
    }
    flush() {
        if (this.logs.length === 0) {
            return;
        }
        output_1.output.logSingleLine(`Running release version for project: ${pc.bold(this.color.instance(this.projectName))}`);
        this.logs.forEach((msg) => {
            console.log(pc.bold(this.color.instance(this.projectName)) + ' ' + msg);
        });
        this.logs = [];
    }
}
exports.ProjectLogger = ProjectLogger;
