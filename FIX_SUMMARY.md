# TCP Fragmentation Bug - Fix Summary

## Problem

Gradle E2E tests hanging intermittently when plugin workers send responses back to the main process.

## Root Cause

TCP packet fragmentation bug in `consumeMessagesFromSocket()`. The code checked if each **chunk** ended with `MESSAGE_END_SEQ`, but TCP can split the 12-byte delimiter across packets. When fragmented, complete messages were stuck in the buffer forever.

## The Fix

Changed `packages/nx/src/utils/consume-messages-from-socket.ts` to check if the **accumulated message** ends with `MESSAGE_END_SEQ` instead of just the chunk.

### Before (Broken):

```typescript
if (chunk.endsWith(MESSAGE_END_SEQ)) {
  message += chunk.substring(0, chunk.length - MESSAGE_END_SEQ.length);
  // process...
} else {
  message += chunk; // ❌ Stuck here if MESSAGE_END_SEQ is fragmented
}
```

### After (Fixed):

```typescript
message += chunk; // ✅ Always accumulate first

if (message.endsWith(MESSAGE_END_SEQ)) {
  // ✅ Check accumulated message
  const fullMessage = message.substring(
    0,
    message.length - MESSAGE_END_SEQ.length
  );
  // process...
  message = '';
}
```

## Why This Happens

The PR changed from a 1-byte delimiter (`\x04`) to a 12-byte delimiter (`'NX_MSG_END\x04'`), making TCP fragmentation much more likely, especially with large messages like gradle returns.

Example fragmentation:

- **Sent**: `'{"type":"result",...}NX_MSG_END\x04'`
- **Received as**:
  - Packet 1: `'{"type":"result",...}NX_MSG_E'` ← doesn't end with full seq
  - Packet 2: `'ND\x04'` ← doesn't end with full seq either!
- **Result**: Message never processed, 10 minute timeout

## Files Changed

- `packages/nx/src/utils/consume-messages-from-socket.ts` - **TCP fragmentation fix**

## Documentation

- `GRADLE_HANG_INVESTIGATION.md` - Detailed technical analysis
- `INVESTIGATION_SUMMARY.md` - Summary with code examples
- `tcp-fragmentation-bug.txt` - Visual explanation
- `FIX_SUMMARY.md` - This file

## Next Steps

1. Commit the fix
2. Push to CI
3. Monitor gradle E2E tests

The fix should resolve the hanging issue completely.
