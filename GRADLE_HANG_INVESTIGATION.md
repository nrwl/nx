# Gradle E2E Hanging Investigation

## PR Context

- **PR**: https://github.com/nrwl/nx/pull/33192
- **Title**: Reapply "fix(core): add option to use v8 for daemon message serialization"
- **Branch**: `reapply-binary-daemon-messages`

## Problem Description

The PR changes the daemon messaging protocol from JSON-only to support both JSON and V8 serialization. During gradle E2E tests, the system hangs when:

1. Main process sends a message to a plugin worker
2. Plugin worker processes the work
3. **Plugin worker's response never reaches the main process (or isn't recognized)**

The main process waits indefinitely for the response that never arrives.

## Key Changes in PR

### 1. Message End Sequence Change

**Before**: Used single character `String.fromCodePoint(4)` (EOT character)
**After**: Uses `MESSAGE_END_SEQ = 'NX_MSG_END' + String.fromCharCode(4)`

### 2. Message Parsing Logic Change

#### Original Code (master)

```typescript
const chunk = data.toString();
if (chunk.codePointAt(chunk.length - 1) === 4) {
  message += chunk.substring(0, chunk.length - 1);
  const messages = message.split(''); // BUG: splits into characters!
  for (const splitMessage of messages) {
    callback(splitMessage);
  }
  message = '';
} else {
  message += chunk;
}
```

#### New Code (PR)

```typescript
const chunk = data.toString();
if (chunk.endsWith(MESSAGE_END_SEQ)) {
  message += chunk.substring(0, chunk.length - MESSAGE_END_SEQ.length);
  const messages = message.split(MESSAGE_END_SEQ);
  for (const splitMessage of messages) {
    if (splitMessage) {
      callback(splitMessage);
    }
  }
  message = '';
} else {
  message += chunk;
}
```

## CRITICAL BUG IDENTIFIED: TCP Packet Fragmentation

### The Bug

The code checks if the **chunk** ends with `MESSAGE_END_SEQ`, but should check if the **accumulated message** ends with it.

### Failure Scenario

When a worker sends a response:

```javascript
socket.write(JSON.stringify(response) + MESSAGE_END_SEQ);
```

Due to TCP packet fragmentation, this can arrive in multiple chunks:

**Chunk 1**: `'{"type":"createNodesResult","payload":{...}}NX_MSG_E'`
**Chunk 2**: `'ND\x04'`

**Processing**:

1. Chunk 1 arrives

   - Does `chunk.endsWith('NX_MSG_END\x04')`? **NO** (ends with `'NX_MSG_E'`)
   - `message += chunk` → accumulates partial message
   - Waits for more data

2. Chunk 2 arrives
   - Does `chunk.endsWith('NX_MSG_END\x04')`? **NO** (only contains `'ND\x04'`)
   - `message += chunk` → accumulates more
   - Waits for more data forever... **HANG!**

The complete message now contains `MESSAGE_END_SEQ`, but we never check for it!

### Why It Might Work Sometimes

If the TCP packets align correctly and the chunk always contains the complete `MESSAGE_END_SEQ` at the end, the bug doesn't manifest. This explains intermittent failures.

## Additional Concerns

### 1. Binary Data Handling

When V8 serialization is used for daemon communication, binary data is converted to string with `.toString()`. This could corrupt the MESSAGE_END_SEQ if binary bytes happen to match part of the sequence.

### 2. Multiple Messages in Transit

If multiple complete messages are sent but the chunk doesn't end with MESSAGE_END_SEQ, all messages wait in the buffer unnecessarily.

### 3. No Timeout on Message Accumulation

If a message is malformed or incomplete, it accumulates forever with no cleanup mechanism.

## Message Flow Architecture

### Plugin Worker Communication (JSON only)

1. **Main → Worker**: `sendMessageOverSocket(socket, {type, payload})`

   - Uses: `JSON.stringify(message) + MESSAGE_END_SEQ`

2. **Worker processes**: Calls plugin's createNodes/createDependencies/etc.

3. **Worker → Main**: Returns result via `sendMessageOverSocket(socket, result)`

   - Uses: `JSON.stringify(message) + MESSAGE_END_SEQ`

4. **Main receives**: `consumeMessagesFromSocket(createWorkerHandler(...))`
   - **BUG LOCATION**: May not detect MESSAGE_END_SEQ if fragmented

### Daemon Communication (JSON or V8)

- Supports both JSON and V8 serialization
- Uses same MESSAGE_END_SEQ
- V8 binary data + string delimiters = potential corruption risk

## Files Affected

### Core Message Handling

- `packages/nx/src/utils/consume-messages-from-socket.ts` - **BUG LOCATION**
- `packages/nx/src/project-graph/plugins/isolation/messaging.ts`
- `packages/nx/src/project-graph/plugins/isolation/plugin-pool.ts`
- `packages/nx/src/project-graph/plugins/isolation/plugin-worker.ts`

### Daemon

- `packages/nx/src/daemon/server/server.ts`
- `packages/nx/src/daemon/client/client.ts`
- `packages/nx/src/daemon/client/daemon-socket-messenger.ts`
- `packages/nx/src/daemon/is-v8-serializer-enabled.ts`

### Other

- `packages/nx/src/tasks-runner/pseudo-ipc.ts`

## Proposed Fix

Check if the accumulated message (after adding chunk) ends with MESSAGE_END_SEQ:

```typescript
export function consumeMessagesFromSocket(callback: (message: string) => void) {
  let message = '';
  return (data) => {
    const chunk = data.toString();
    message += chunk;

    // Check if accumulated message ends with MESSAGE_END_SEQ
    if (message.endsWith(MESSAGE_END_SEQ)) {
      // Remove trailing MESSAGE_END_SEQ
      const fullMessage = message.substring(
        0,
        message.length - MESSAGE_END_SEQ.length
      );

      // Split by MESSAGE_END_SEQ to handle multiple messages
      const messages = fullMessage.split(MESSAGE_END_SEQ);
      for (const splitMessage of messages) {
        if (splitMessage) {
          callback(splitMessage);
        }
      }

      message = '';
    }
    // If doesn't end with MESSAGE_END_SEQ, accumulate and wait for more
  };
}
```

## Testing Strategy

To verify this fix:

1. Add logging before/after message accumulation
2. Log chunk sizes and content
3. Test with network throttling to force fragmentation
4. Run gradle E2E tests repeatedly
5. Monitor for hangs and check logs

## Fix Implemented

The fix has been applied to `packages/nx/src/utils/consume-messages-from-socket.ts`:

**Changed from:**

```typescript
if (chunk.endsWith(MESSAGE_END_SEQ)) {
  message += chunk.substring(0, chunk.length - MESSAGE_END_SEQ.length);
  // process messages...
} else {
  message += chunk; // accumulate forever if fragmented
}
```

**Changed to:**

```typescript
message += chunk; // Always accumulate first

if (message.endsWith(MESSAGE_END_SEQ)) {
  // Check accumulated message
  const fullMessage = message.substring(
    0,
    message.length - MESSAGE_END_SEQ.length
  );
  // process messages...
  message = '';
}
// If doesn't end with MESSAGE_END_SEQ, keep accumulating
```

## Next Steps

1. ✅ Document findings
2. ✅ Implement the fix
3. ⏳ Test locally with gradle E2E (optional)
4. ⏳ Commit and push to CI
5. ⏳ Monitor gradle E2E tests to confirm they pass
