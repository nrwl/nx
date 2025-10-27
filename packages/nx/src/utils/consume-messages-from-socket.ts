export const MESSAGE_END_SEQ = 'NX_MSG_END' + String.fromCharCode(4);

export function consumeMessagesFromSocket(callback: (message: string) => void) {
  let message = '';
  return (data) => {
    const chunk = data.toString();
    message += chunk;

    // Check if accumulated message ends with MESSAGE_END_SEQ (not just the chunk)
    // This handles TCP packet fragmentation where MESSAGE_END_SEQ may be split across packets
    if (message.endsWith(MESSAGE_END_SEQ)) {
      // Remove the trailing MESSAGE_END_SEQ
      const fullMessage = message.substring(
        0,
        message.length - MESSAGE_END_SEQ.length
      );

      // Server may send multiple messages in one chunk, so splitting by MESSAGE_END_SEQ
      const messages = fullMessage.split(MESSAGE_END_SEQ);
      for (const splitMessage of messages) {
        if (splitMessage) {
          callback(splitMessage);
        }
      }

      message = '';
    }
    // If message doesn't end with MESSAGE_END_SEQ, keep accumulating chunks
  };
}

export function isJsonMessage(message: string): boolean {
  return (
    // json objects
    ['[', '{'].some((prefix) => message.startsWith(prefix)) ||
    // booleans
    message === 'true' ||
    message === 'false' ||
    // strings
    (message.startsWith('"') && message.endsWith('"')) ||
    // numbers
    /^[0-9]+(\.?[0-9]+)?$/.test(message)
  );
}
