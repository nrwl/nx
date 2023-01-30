#!/bin/bash
script="'use strict';
// The contents of this file, once transpiled, are inlined into nx.sh and nx.bat.
// As such, we cannot import anything from nx or other @nrwl packages. Node
// builtins only.
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var nxJsonPath = path.join(__dirname, 'nx.json');
var nxJson;
try {
    nxJson = JSON.parse(fs.readFileSync(nxJsonPath, 'utf-8'));
}
catch (_a) {
    // We should do something here.....
    // Should we assume they want latest?
    // Should we ask and then create an nx.json with the version?
    // Should we use latest and not store it?
}
var installationPath = path.join(__dirname, '.nx', 'installation', 'package.json');
try {
    ensureDir('.nx/installation');
    if (!matchesCurrentNxInstall(nxJson.installation)) {
        fs.writeFileSync(installationPath, JSON.stringify({
            name: 'nx-installation',
            devDependencies: __assign({ nx: nxJson.installation.version }, nxJson.installation.plugins)
        }));
        cp.execSync('npm i', {
            cwd: path.dirname(installationPath)
        });
    }
}
catch (_b) { }
function matchesCurrentNxInstall(installation) {
    try {
        var currentInstallation = JSON.parse(fs.readFileSync(installationPath, 'utf-8'));
        if (currentInstallation.dependencies['nx'] !== installation.version) {
            return false;
        }
        for (var _i = 0, _a = installation.plugins || {}; _i < _a.length; _i++) {
            var plugin = _a[_i];
            if (currentInstallation.dependencies[plugin] !==
                installation.plugins[plugin]) {
                return false;
            }
        }
        return true;
    }
    catch (_b) {
        return false;
    }
}
function ensureDir(p) {
    if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
    }
}
"
node -e "$script"
node .nx/installation/node_modules/nx/bin/nx.js $@