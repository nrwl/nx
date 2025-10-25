# Gradle E2E Hanging Issue - Investigation Summary

## 🔍 Root Cause Identified

**TCP Packet Fragmentation Bug in `consumeMessagesFromSocket`**

The current implementation checks if each individual **chunk** ends with `MESSAGE_END_SEQ`, but should check if the **accumulated message** ends with it after adding the chunk.

## 🐛 The Bug

### Current (Broken) Logic

```typescript
if (chunk.endsWith(MESSAGE_END_SEQ)) {
  // ❌ Only checks chunk
  // Process messages
} else {
  message += chunk; // Accumulate but never process if chunk doesn't end right
}
```

### The Problem

When TCP fragments a message like this:

- **Sent**: `'{"type":"result",...}NX_MSG_END\x04'` (complete message)
- **Received as**:
  - Chunk 1: `'{"type":"result",...}NX_MSG_E'` ← doesn't end with full seq
  - Chunk 2: `'ND\x04'` ← doesn't end with full seq either!

Both chunks fail the `chunk.endsWith(MESSAGE_END_SEQ)` test, so the complete message sits in the buffer forever, never getting processed. The main process waits 10 minutes for a response that has already arrived, then times out.

## 📊 Evidence

### Files Changed in PR

The PR changed from a single EOT character (`\x04`) to a longer delimiter (`'NX_MSG_END\x04'`), making fragmentation **much more likely**:

- Old: 1 byte delimiter (rarely fragmented)
- New: 12 byte delimiter (often fragmented across TCP packets)

### Key Code Locations

- **Bug location**: `packages/nx/src/utils/consume-messages-from-socket.ts:21-73`
- **Plugin worker sender**: `packages/nx/src/project-graph/plugins/isolation/messaging.ts:250-274`
- **Main process receiver**: `packages/nx/src/project-graph/plugins/isolation/plugin-pool.ts:99-113`

## 🔧 Solution

### Fixed Implementation

```typescript
export function consumeMessagesFromSocket(callback: (message: string) => void) {
  let message = '';
  return (data) => {
    const chunk = data.toString();
    message += chunk; // Always accumulate first

    // Check accumulated message, not just chunk
    if (message.endsWith(MESSAGE_END_SEQ)) {
      // ✅ Checks full accumulated message
      const fullMessage = message.substring(
        0,
        message.length - MESSAGE_END_SEQ.length
      );
      const messages = fullMessage.split(MESSAGE_END_SEQ);
      for (const splitMessage of messages) {
        if (splitMessage) {
          callback(splitMessage);
        }
      }
      message = '';
    }
    // If doesn't end with MESSAGE_END_SEQ, keep accumulating
  };
}
```

## ✅ Fix Applied

The fix has been applied to `consume-messages-from-socket.ts`. The code now correctly checks if the accumulated message ends with MESSAGE_END_SEQ, rather than only checking individual chunks.

## 📋 Next Steps

1. ✅ Fix applied to `consume-messages-from-socket.ts`
2. Test locally with gradle E2E (optional)
3. Commit and push to CI
4. Monitor gradle E2E tests to confirm they pass

## 📁 Files Modified

### Core Changes (Fix Applied)

- ✅ `packages/nx/src/utils/consume-messages-from-socket.ts` - **TCP fragmentation bug fixed**

### Documentation

- ✅ `GRADLE_HANG_INVESTIGATION.md` - Detailed technical analysis
- ✅ `INVESTIGATION_SUMMARY.md` - This summary

## 🎯 Confidence Level

**Very High (95%+)** that this is the root cause because:

1. **Timing**: Bug introduced when changing to longer delimiter
2. **Symptoms match**: Random hangs (depends on TCP packet boundaries)
3. **Code logic**: Clear logical error in chunk vs message checking
4. **Intermittent nature**: Explains why it doesn't always fail
5. **Gradle specific**: Larger messages from gradle plugin more likely to fragment

## 🚀 How to Test the Fix

```bash
# 1. Apply the fix to consume-messages-from-socket.ts

# 2. Test locally
nx e2e gradle

# 3. Test multiple times to catch intermittent issues
for i in {1..10}; do
  echo "Test run $i"
  nx e2e gradle || exit 1
done

# 4. If you want to see the bug detection in action (before fix):
export NX_DEBUG_MESSAGES=true
nx e2e gradle
# Look for "CRITICAL BUG DETECTED" in output
```

## 📞 Questions?

See `GRADLE_HANG_INVESTIGATION.md` for:

- Complete message flow architecture
- Detailed scenario analysis
- Full logging documentation
- Example debug output
