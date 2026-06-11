"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentMachineId = getCurrentMachineId;
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
let _cachedMachineId = null;
/**
 * Returns the platform-specific command to retrieve the machine GUID.
 */
function getMachineIdCommand() {
    switch (process.platform) {
        case 'darwin':
            return 'ioreg -rd1 -c IOPlatformExpertDevice';
        case 'win32': {
            const regPath = process.arch === 'ia32' &&
                process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432')
                ? '%windir%\\sysnative\\cmd.exe /c %windir%\\System32'
                : '%windir%\\System32';
            return (`${regPath}\\REG.exe ` +
                'QUERY HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography ' +
                '/v MachineGuid');
        }
        case 'linux':
            return '( cat /var/lib/dbus/machine-id /etc/machine-id 2> /dev/null || hostname ) | head -n 1 || :';
        case 'freebsd':
            return 'kenv -q smbios.system.uuid || sysctl -n kern.hostuuid';
        default:
            throw new Error(`Unsupported platform: ${process.platform}`);
    }
}
/**
 * Parses the raw command output into a clean machine GUID string.
 */
function parseCommandOutput(raw) {
    switch (process.platform) {
        case 'darwin':
            return raw
                .split('IOPlatformUUID')[1]
                .split('\n')[0]
                .replace(/=|\s+|"/gi, '')
                .toLowerCase();
        case 'win32':
            return raw
                .toString()
                .split('REG_SZ')[1]
                .replace(/\r+|\n+|\s+/gi, '')
                .toLowerCase();
        case 'linux':
        case 'freebsd':
            return raw
                .toString()
                .replace(/\r+|\n+|\s+/gi, '')
                .toLowerCase();
        default:
            throw new Error(`Unsupported platform: ${process.platform}`);
    }
}
function hashId(guid) {
    return (0, crypto_1.createHash)('sha256').update(guid).digest('hex');
}
/**
 * Retrieves the machine ID by executing a platform-specific command.
 * Uses windowsHide: true to prevent console windows from appearing
 * when called from detached processes (daemon, plugin workers).
 */
function machineId() {
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(getMachineIdCommand(), { windowsHide: true }, (err, stdout) => {
            if (err) {
                return reject(new Error(`Error while obtaining machine id: ${err.stack}`));
            }
            return resolve(hashId(parseCommandOutput(stdout.toString())));
        });
    });
}
/**
 * Get the current machine ID, with caching and error handling
 * @returns The machine ID or empty string if unable to retrieve
 */
async function getCurrentMachineId() {
    if (_cachedMachineId === null) {
        try {
            _cachedMachineId = await machineId();
        }
        catch (e) {
            if (process.env.NX_VERBOSE_LOGGING === 'true') {
                console.log(`Unable to get machineId. Error: ${e.message}`);
            }
            _cachedMachineId = '';
        }
    }
    return _cachedMachineId;
}
