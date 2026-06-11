"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const run_1 = require("../src/command-line/run/run");
if (process.env.NX_TERMINAL_OUTPUT_PATH) {
    setUpOutputWatching(process.env.NX_TERMINAL_CAPTURE_STDERR === 'true', process.env.NX_STREAM_OUTPUT === 'true');
}
if (!process.env.NX_WORKSPACE_ROOT) {
    console.error('Invalid Nx command invocation');
    process.exit(1);
}
process.env.NX_CLI_SET = 'true';
/**
 * We need to collect all stdout and stderr and store it, so the caching mechanism
 * could store it.
 *
 * Writing stdout and stderr into different streams is too risky when using TTY.
 *
 * So we are simply monkey-patching the Javascript object. In this case the actual output will always be correct.
 * And the cached output should be correct unless the CLI bypasses process.stdout or console.log and uses some
 * C-binary to write to stdout.
 */
function setUpOutputWatching(captureStderr, streamOutput) {
    const stdoutWrite = process.stdout._write;
    const stderrWrite = process.stderr._write;
    // The terminal output file gets out and err
    const outputPath = process.env.NX_TERMINAL_OUTPUT_PATH;
    const stdoutAndStderrLogFileHandle = (0, fs_1.openSync)(outputPath, 'w');
    const onlyStdout = [];
    process.stdout._write = (chunk, encoding, callback) => {
        onlyStdout.push(chunk);
        (0, fs_1.appendFileSync)(stdoutAndStderrLogFileHandle, chunk);
        if (streamOutput) {
            stdoutWrite.apply(process.stdout, [chunk, encoding, callback]);
        }
        else {
            callback();
        }
    };
    process.stderr._write = (chunk, encoding, callback) => {
        (0, fs_1.appendFileSync)(stdoutAndStderrLogFileHandle, chunk);
        if (streamOutput) {
            stderrWrite.apply(process.stderr, [chunk, encoding, callback]);
        }
        else {
            callback();
        }
    };
    process.on('exit', (code) => {
        // when the process exits successfully, and we are not asked to capture stderr
        // override the file with only stdout
        if (code === 0 && !captureStderr) {
            (0, fs_1.writeFileSync)(outputPath, onlyStdout.join(''));
        }
    });
}
process.on('message', async (message) => {
    try {
        const statusCode = await (0, run_1.run)(process.cwd(), process.env.NX_WORKSPACE_ROOT, message.targetDescription, message.overrides, message.isVerbose, message.taskGraph);
        process.exit(statusCode);
    }
    catch (e) {
        console.error(e);
        process.exit(1);
    }
});
