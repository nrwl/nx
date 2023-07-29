export function consumeMessagesFromSocket(callback: (message: string) => void) {
  let message = '';
  return (data) => {
    const chunk = data.toString();
    if (chunk.codePointAt(chunk.length - 1) === 4) {
      message += chunk.substring(0, chunk.length - 1);

      // Server may send multiple messages in one chunk, so splitting by 0x4
      const messages = message.split('');
      for (const splitMessage of messages) {
        callback(splitMessage);
      }

      message = '';
    } else {
      message += chunk;
    }
  };
}
