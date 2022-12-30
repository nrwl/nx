export function consumeMessagesFromSocket(callback: (message: string) => void) {
  let message = '';
  return (data) => {
    const chunk = data.toString();
    if (chunk.codePointAt(chunk.length - 1) === 4) {
      message += chunk.substring(0, chunk.length - 1);
      callback(message);
      message = '';
    } else {
      message += chunk;
    }
  };
}
