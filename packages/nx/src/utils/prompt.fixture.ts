export function passingNamedMethod() {
  return {
    name: 'passing named',
    message: "What's your name?",
    fields: [
      {
        name: 'foo',
        message: 'Name',
      },
    ],
    template: `{ "name": "\${name}" }`,
  };
}

export function missingNameMessage() {
  return {
    fields: [
      {
        name: 'foo',
        message: 'Name',
      },
    ],
    template: `{ "name": "\${name}" }`,
  };
}

export function invalidReturnValue() {
  return 'foo';
}

export async function asyncMethod() {
  return await new Promise((resolve) =>
    setTimeout(() => {
      resolve({
        name: 'async',
        message: "What's your name?",
        fields: [
          {
            name: 'foo',
            message: 'Name',
          },
        ],
        template: `{ "name": "\${name}" }`,
      });
    }, 1)
  );
}

export default function () {
  return {
    name: 'passing default',
    message: "What's your name?",
    fields: [
      {
        name: 'foo',
        message: 'Name',
      },
    ],
    template: `{ "name": "\${name}" }`,
  };
}
