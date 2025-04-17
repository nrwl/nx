export const MESSAGE_END_SEQ = 'NX_MSG_END' + String.fromCharCode(4);

export function consumeMessagesFromSocket(callback: (message: string) => void) {
  let message = '';
  return (data) => {
    const chunk = data.toString();
    if (chunk.endsWith(MESSAGE_END_SEQ)) {
      message += chunk.substring(0, chunk.length - MESSAGE_END_SEQ.length);

      // Server may send multiple messages in one chunk, so splitting by 0x4
      const messages = message.split(MESSAGE_END_SEQ);
      for (const splitMessage of messages) {
        callback(splitMessage);
      }

      message = '';
    } else {
      message += chunk;
    }
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
    /^[0-9]+(.?[0-9]+)?$/.test(message)
  );
}
