/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

process.on('message', (message) => {
  // Only process messages with the hash in 'run-module-as-observable-fork.ts'.
  if (message.hash === '5d4b9a5c0a4e0f9977598437b0e85bcc') {
    const requiredModule = require(message.modulePath);
    if (message.exportName) {
      requiredModule[message.exportName](...message.args);
    } else {
      requiredModule(...message.args);
    }
  }
});

