export function getStringFromStream(response: any): Promise<string | Error> {
  const reader = response?.body?.getReader();
  let text = '';

  function readStream() {
    return reader?.read()?.then(function (result: any) {
      if (result?.done) {
        return text;
      }

      const chunk = new TextDecoder('utf-8').decode(result?.value);
      text += chunk;

      return readStream();
    });
  }

  return new Promise((resolve, reject) => {
    readStream()
      ?.then((completeText: string) => resolve(completeText))
      ?.catch((e: any) => reject(e));
  });
}
