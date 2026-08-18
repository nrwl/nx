import { extractNpmPublishJsonData } from './extract-npm-publish-json-data';

describe('extractNpmPublishJsonData()', () => {
  describe('only unrelated JSON data', () => {
    // Does not match expected npm publish JSON data
    const data = {
      foo: true,
      bar: [1, 2, 3],
    };

    it('should safely ignore unrelated formatted JSON data', () => {
      const formattedJsonStr = JSON.stringify(data, null, 2);
      const res = extractNpmPublishJsonData(formattedJsonStr);

      expect(res.beforeJsonData).toMatchInlineSnapshot(`
        "{
          "foo": true,
          "bar": [
            1,
            2,
            3
          ]
        }"
      `);
      expect(res.jsonData).toEqual(null);
      expect(res.afterJsonData).toMatchInlineSnapshot(`""`);
    });

    it('should safely ignore unrelated unformatted JSON data', () => {
      const unformattedJsonStr = JSON.stringify(data);
      const res = extractNpmPublishJsonData(unformattedJsonStr);

      expect(res.beforeJsonData).toMatchInlineSnapshot(
        `"{"foo":true,"bar":[1,2,3]}"`
      );
      expect(res.jsonData).toEqual(null);
      expect(res.afterJsonData).toMatchInlineSnapshot(`""`);
    });
  });

  describe('mixed unrelated JSON and non-JSON data', () => {
    // Does not match expected npm publish JSON data
    const data = {
      foo: true,
      bar: [1, 2, 3],
    };
    const extraContentBefore = 'Some random text';
    const extraContentAfter = 'More random text';

    it('should safely ignore unrelated mixed data containing formatted JSON', () => {
      const formattedJsonStr = JSON.stringify(data, null, 2);
      const res = extractNpmPublishJsonData(`${extraContentBefore}
${formattedJsonStr}
${extraContentAfter}`);

      expect(res.beforeJsonData).toMatchInlineSnapshot(`
        "Some random text
        {
          "foo": true,
          "bar": [
            1,
            2,
            3
          ]
        }
        More random text"
      `);
      expect(res.jsonData).toEqual(null);
      expect(res.afterJsonData).toMatchInlineSnapshot(`""`);
    });

    it('should safely ignore unrelated mixed data containing unformatted JSON', () => {
      const unformattedJsonStr = JSON.stringify(data);
      const res = extractNpmPublishJsonData(`${extraContentBefore}
${unformattedJsonStr}
${extraContentAfter}`);

      expect(res.beforeJsonData).toMatchInlineSnapshot(`
        "Some random text
        {"foo":true,"bar":[1,2,3]}
        More random text"
      `);
      expect(res.jsonData).toEqual(null);
      expect(res.afterJsonData).toMatchInlineSnapshot(`""`);
    });
  });

  describe('output containing npm publish JSON data', () => {
    it('should extract the relevant JSON data from a simple publish output string containing only the data', () => {
      const commandOutput = `{
  "id": "package-a@1.0.0",
  "name": "package-a",
  "version": "1.0.0",
  "size": 251,
  "unpackedSize": 233,
  "shasum": "cf4a6657f230ddf5375102bafc8f5184002a620a",
  "integrity": "sha512-Qra/YIkAxVavs3tumB/svugHLY5CISujdeUcMd2FfvtVkjEEsVAEYbqZTq0ixnkvjVrLr27mAvH94GjjMKWzIg==",
  "filename": "package-a-1.0.0.tgz",
  "files": [
    {
      "path": "package.json",
      "size": 233,
      "mode": 420
    }
  ],
  "entryCount": 1,
  "bundled": []
}`;
      const res = extractNpmPublishJsonData(commandOutput);

      expect(res.beforeJsonData).toMatchInlineSnapshot(`""`);
      expect(res.jsonData).toMatchInlineSnapshot(`
        {
          "bundled": [],
          "entryCount": 1,
          "filename": "package-a-1.0.0.tgz",
          "files": [
            {
              "mode": 420,
              "path": "package.json",
              "size": 233,
            },
          ],
          "id": "package-a@1.0.0",
          "integrity": "sha512-Qra/YIkAxVavs3tumB/svugHLY5CISujdeUcMd2FfvtVkjEEsVAEYbqZTq0ixnkvjVrLr27mAvH94GjjMKWzIg==",
          "name": "package-a",
          "shasum": "cf4a6657f230ddf5375102bafc8f5184002a620a",
          "size": 251,
          "unpackedSize": 233,
          "version": "1.0.0",
        }
      `);
      expect(res.afterJsonData).toMatchInlineSnapshot(`""`);
    });

    it('should extract the relevant JSON data from a publish output string containing lifecycle script outputs', () => {
      const exampleCommandOutputWithLifecycleScripts = `
> package-a@1.0.0 prepublishOnly
> echo 'prepublishOnly from package-a'

prepublishOnly from package-a
{
  "id": "package-a@1.0.0",
  "name": "package-a",
  "version": "1.0.0",
  "size": 206,
  "unpackedSize": 179,
  "shasum": "f01c6f5c8d72ed33e70c1c1b1258f46c92360e57",
  "integrity": "sha512-24/pgfxiTiNB/dw7ZbBZ+I1vidq09KU6n/QgXCtx1y4+ezYpEBSncdrEpDxuMD6YaP8twg3H8zQBLoG8xwygcA==",
  "filename": "package-a-1.0.0.tgz",
  "files": [
    {
      "path": "package.json",
      "size": 179,
      "mode": 420
    }
  ],
  "entryCount": 1,
  "bundled": []
}
`;
      const res = extractNpmPublishJsonData(
        exampleCommandOutputWithLifecycleScripts
      );

      expect(res.beforeJsonData).toMatchInlineSnapshot(`
        "
        > package-a@1.0.0 prepublishOnly
        > echo 'prepublishOnly from package-a'

        prepublishOnly from package-a
        "
      `);

      expect(res.jsonData).toMatchInlineSnapshot(`
        {
          "bundled": [],
          "entryCount": 1,
          "filename": "package-a-1.0.0.tgz",
          "files": [
            {
              "mode": 420,
              "path": "package.json",
              "size": 179,
            },
          ],
          "id": "package-a@1.0.0",
          "integrity": "sha512-24/pgfxiTiNB/dw7ZbBZ+I1vidq09KU6n/QgXCtx1y4+ezYpEBSncdrEpDxuMD6YaP8twg3H8zQBLoG8xwygcA==",
          "name": "package-a",
          "shasum": "f01c6f5c8d72ed33e70c1c1b1258f46c92360e57",
          "size": 206,
          "unpackedSize": 179,
          "version": "1.0.0",
        }
      `);

      expect(res.afterJsonData).toMatchInlineSnapshot(`
        "
        "
      `);
    });

    it('should work when a user lifecycle script adds custom, unformatted JSON data to the output', () => {
      const exampleCommandOutputWithLifecycleScripts = `
> package-a@1.0.0 prepublishOnly
> node -e 'console.log(JSON.stringify({"name": "package-a", "version": "1.0.0"}));'

{"name":"package-a","version":"1.0.0"}
{
  "id": "package-a@1.0.0",
  "name": "package-a",
  "version": "1.0.0",
  "size": 249,
  "unpackedSize": 232,
  "shasum": "63caa58603b8f9b76a5151ad4e965c3ac0b83c71",
  "integrity": "sha512-mXgusXuPfyvqNpnHY3F0TwLiitKzt98hcAxgEq6/uueEM53haisRQx+tf5FEE6uNRhE+9U0A2y9//KD2OPnSBQ==",
  "filename": "package-a-1.0.0.tgz",
  "files": [
    {
      "path": "package.json",
      "size": 232,
      "mode": 420
    }
  ],
  "entryCount": 1,
  "bundled": []
}`;
      const res = extractNpmPublishJsonData(
        exampleCommandOutputWithLifecycleScripts
      );

      expect(res.beforeJsonData).toMatchInlineSnapshot(`
        "
        > package-a@1.0.0 prepublishOnly
        > node -e 'console.log(JSON.stringify({"name": "package-a", "version": "1.0.0"}));'

        {"name":"package-a","version":"1.0.0"}
        "
      `);

      expect(res.jsonData).toMatchInlineSnapshot(`
        {
          "bundled": [],
          "entryCount": 1,
          "filename": "package-a-1.0.0.tgz",
          "files": [
            {
              "mode": 420,
              "path": "package.json",
              "size": 232,
            },
          ],
          "id": "package-a@1.0.0",
          "integrity": "sha512-mXgusXuPfyvqNpnHY3F0TwLiitKzt98hcAxgEq6/uueEM53haisRQx+tf5FEE6uNRhE+9U0A2y9//KD2OPnSBQ==",
          "name": "package-a",
          "shasum": "63caa58603b8f9b76a5151ad4e965c3ac0b83c71",
          "size": 249,
          "unpackedSize": 232,
          "version": "1.0.0",
        }
      `);

      expect(res.afterJsonData).toMatchInlineSnapshot(`""`);
    });

    it('should extract and unwrap the JSON data when npm >= 11.16 nests the summary under the package name', () => {
      // npm >= 11.16 (bundled with Node 26) nests the publish summary under the
      // package name instead of printing it as a flat object.
      const commandOutput = `{
  "@scope/package-a": {
    "id": "@scope/package-a@1.0.0",
    "name": "@scope/package-a",
    "version": "1.0.0",
    "size": 251,
    "unpackedSize": 233,
    "shasum": "cf4a6657f230ddf5375102bafc8f5184002a620a",
    "integrity": "sha512-Qra/YIkAxVavs3tumB/svugHLY5CISujdeUcMd2FfvtVkjEEsVAEYbqZTq0ixnkvjVrLr27mAvH94GjjMKWzIg==",
    "filename": "scope-package-a-1.0.0.tgz",
    "files": [
      {
        "path": "package.json",
        "size": 233,
        "mode": 420
      }
    ],
    "entryCount": 1,
    "bundled": []
  }
}`;
      const res = extractNpmPublishJsonData(commandOutput);

      // The wrapper braces must not leak into beforeJsonData/afterJsonData.
      expect(res.beforeJsonData).toMatchInlineSnapshot(`""`);
      expect(res.jsonData).toMatchInlineSnapshot(`
        {
          "bundled": [],
          "entryCount": 1,
          "filename": "scope-package-a-1.0.0.tgz",
          "files": [
            {
              "mode": 420,
              "path": "package.json",
              "size": 233,
            },
          ],
          "id": "@scope/package-a@1.0.0",
          "integrity": "sha512-Qra/YIkAxVavs3tumB/svugHLY5CISujdeUcMd2FfvtVkjEEsVAEYbqZTq0ixnkvjVrLr27mAvH94GjjMKWzIg==",
          "name": "@scope/package-a",
          "shasum": "cf4a6657f230ddf5375102bafc8f5184002a620a",
          "size": 251,
          "unpackedSize": 233,
          "version": "1.0.0",
        }
      `);
      expect(res.afterJsonData).toMatchInlineSnapshot(`""`);
    });

    it('should extract and unwrap nested JSON data alongside lifecycle script outputs', () => {
      const commandOutput = `
> @scope/package-a@1.0.0 prepublishOnly
> echo 'prepublishOnly from package-a'

prepublishOnly from package-a
{
  "@scope/package-a": {
    "id": "@scope/package-a@1.0.0",
    "name": "@scope/package-a",
    "version": "1.0.0",
    "size": 206,
    "unpackedSize": 179,
    "shasum": "f01c6f5c8d72ed33e70c1c1b1258f46c92360e57",
    "integrity": "sha512-24/pgfxiTiNB/dw7ZbBZ+I1vidq09KU6n/QgXCtx1y4+ezYpEBSncdrEpDxuMD6YaP8twg3H8zQBLoG8xwygcA==",
    "filename": "scope-package-a-1.0.0.tgz",
    "files": [
      {
        "path": "package.json",
        "size": 179,
        "mode": 420
      }
    ],
    "entryCount": 1,
    "bundled": []
  }
}
`;
      const res = extractNpmPublishJsonData(commandOutput);

      expect(res.beforeJsonData).toMatchInlineSnapshot(`
        "
        > @scope/package-a@1.0.0 prepublishOnly
        > echo 'prepublishOnly from package-a'

        prepublishOnly from package-a
        "
      `);
      expect(res.jsonData).toMatchInlineSnapshot(`
        {
          "bundled": [],
          "entryCount": 1,
          "filename": "scope-package-a-1.0.0.tgz",
          "files": [
            {
              "mode": 420,
              "path": "package.json",
              "size": 179,
            },
          ],
          "id": "@scope/package-a@1.0.0",
          "integrity": "sha512-24/pgfxiTiNB/dw7ZbBZ+I1vidq09KU6n/QgXCtx1y4+ezYpEBSncdrEpDxuMD6YaP8twg3H8zQBLoG8xwygcA==",
          "name": "@scope/package-a",
          "shasum": "f01c6f5c8d72ed33e70c1c1b1258f46c92360e57",
          "size": 206,
          "unpackedSize": 179,
          "version": "1.0.0",
        }
      `);
      expect(res.afterJsonData).toMatchInlineSnapshot(`
        "
        "
      `);
    });

    it('should extract the relevant JSON data when formatted JSON data is present alongside the expected npm publish JSON data', () => {
      const exampleCommandOutputWithFormattedJSON = `
      {
        "unrelated": true,
        "data": [
          1,
          2,
          3
        ]
      }
      {
        "id": "package-a@1.0.0",
        "name": "package-a",
        "version": "1.0.0",
        "size": 249,
        "unpackedSize": 232,
        "shasum": "63caa58603b8f9b76a5151ad4e965c3ac0b83c71",
        "integrity": "sha512-mXgusXuPfyvqNpnHY3F0TwLiitKzt98hcAxgEq6/uueEM53haisRQx+tf5FEE6uNRhE+9U0A2y9//KD2OPnSBQ==",
        "filename": "package-a-1.0.0.tgz",
        "files": [
          {
            "path": "package.json",
            "size": 232,
            "mode": 420
          }
        ],
        "entryCount": 1,
        "bundled": []
      }
      {
        "extra": "data",
        "foo": "bar"
      }`;

      const res = extractNpmPublishJsonData(
        exampleCommandOutputWithFormattedJSON
      );

      expect(res.beforeJsonData).toMatchInlineSnapshot(`
        "
              {
                "unrelated": true,
                "data": [
                  1,
                  2,
                  3
                ]
              }
              "
      `);

      expect(res.jsonData).toMatchInlineSnapshot(`
        {
          "bundled": [],
          "entryCount": 1,
          "filename": "package-a-1.0.0.tgz",
          "files": [
            {
              "mode": 420,
              "path": "package.json",
              "size": 232,
            },
          ],
          "id": "package-a@1.0.0",
          "integrity": "sha512-mXgusXuPfyvqNpnHY3F0TwLiitKzt98hcAxgEq6/uueEM53haisRQx+tf5FEE6uNRhE+9U0A2y9//KD2OPnSBQ==",
          "name": "package-a",
          "shasum": "63caa58603b8f9b76a5151ad4e965c3ac0b83c71",
          "size": 249,
          "unpackedSize": 232,
          "version": "1.0.0",
        }
      `);

      expect(res.afterJsonData).toMatchInlineSnapshot(`
        "
              {
                "extra": "data",
                "foo": "bar"
              }"
      `);
    });

    it('should extract the relevant JSON data when a files[].path contains curly braces', () => {
      // pnpm/npm publish emit the literal file path, so a template dir such as
      // "templates/{{name}}" puts braces inside a string value. A brace-counting
      // regex mismatches the top-level object here; the scanner must not (#36236).
      const commandOutput = `{
  "id": "repro-curly-braces@0.0.1",
  "name": "repro-curly-braces",
  "version": "0.0.1",
  "size": 300,
  "unpackedSize": 200,
  "shasum": "cf4a6657f230ddf5375102bafc8f5184002a620a",
  "integrity": "sha512-Qra/YIkAxVavs3tumB/svugHLY5CISujdeUcMd2FfvtVkjEEsVAEYbqZTq0ixnkvjVrLr27mAvH94GjjMKWzIg==",
  "filename": "repro-curly-braces-0.0.1.tgz",
  "files": [
    {
      "path": "package.json",
      "size": 200,
      "mode": 420
    },
    {
      "path": "templates/{{name}}/file.txt",
      "size": 6,
      "mode": 420
    }
  ],
  "entryCount": 2,
  "bundled": []
}`;
      const res = extractNpmPublishJsonData(commandOutput);

      expect(res.beforeJsonData).toMatchInlineSnapshot(`""`);
      expect(res.jsonData).toMatchInlineSnapshot(`
        {
          "bundled": [],
          "entryCount": 2,
          "filename": "repro-curly-braces-0.0.1.tgz",
          "files": [
            {
              "mode": 420,
              "path": "package.json",
              "size": 200,
            },
            {
              "mode": 420,
              "path": "templates/{{name}}/file.txt",
              "size": 6,
            },
          ],
          "id": "repro-curly-braces@0.0.1",
          "integrity": "sha512-Qra/YIkAxVavs3tumB/svugHLY5CISujdeUcMd2FfvtVkjEEsVAEYbqZTq0ixnkvjVrLr27mAvH94GjjMKWzIg==",
          "name": "repro-curly-braces",
          "shasum": "cf4a6657f230ddf5375102bafc8f5184002a620a",
          "size": 300,
          "unpackedSize": 200,
          "version": "0.0.1",
        }
      `);
      expect(res.afterJsonData).toMatchInlineSnapshot(`""`);
    });

    it('should still extract the summary when surrounding output has unbalanced braces', () => {
      // A lifecycle script can print arbitrary text: balanced brace pairs that are
      // not JSON (the {{name}} in the echoed line) alongside a genuinely unmatched
      // trailing '}'. Neither must swallow or corrupt the real summary object,
      // whose files[].path also carries braces.
      const commandOutput = `> repro@0.0.1 prepublishOnly
> echo "generating {{name}} scaffold"

generating {{name}} scaffold
{
  "id": "repro@0.0.1",
  "name": "repro",
  "version": "0.0.1",
  "size": 300,
  "unpackedSize": 200,
  "shasum": "cf4a6657f230ddf5375102bafc8f5184002a620a",
  "integrity": "sha512-Qra/YIkAxVavs3tumB/svugHLY5CISujdeUcMd2FfvtVkjEEsVAEYbqZTq0ixnkvjVrLr27mAvH94GjjMKWzIg==",
  "filename": "repro-0.0.1.tgz",
  "files": [
    {
      "path": "templates/{{name}}/file.txt",
      "size": 6,
      "mode": 420
    }
  ],
  "entryCount": 1,
  "bundled": []
}
done }`;
      const res = extractNpmPublishJsonData(commandOutput);

      expect(res.beforeJsonData).toMatchInlineSnapshot(`
        "> repro@0.0.1 prepublishOnly
        > echo "generating {{name}} scaffold"

        generating {{name}} scaffold
        "
      `);
      expect(res.jsonData).toMatchInlineSnapshot(`
        {
          "bundled": [],
          "entryCount": 1,
          "filename": "repro-0.0.1.tgz",
          "files": [
            {
              "mode": 420,
              "path": "templates/{{name}}/file.txt",
              "size": 6,
            },
          ],
          "id": "repro@0.0.1",
          "integrity": "sha512-Qra/YIkAxVavs3tumB/svugHLY5CISujdeUcMd2FfvtVkjEEsVAEYbqZTq0ixnkvjVrLr27mAvH94GjjMKWzIg==",
          "name": "repro",
          "shasum": "cf4a6657f230ddf5375102bafc8f5184002a620a",
          "size": 300,
          "unpackedSize": 200,
          "version": "0.0.1",
        }
      `);
      expect(res.afterJsonData).toMatchInlineSnapshot(`
        "
        done }"
      `);
    });

    it('should still extract the summary when preceding output has an unpaired quote', () => {
      // Lifecycle output before the JSON can carry a lone '"' (an inch mark here).
      // Quote tracking must not leak from that plain text onto the summary and
      // hide its braces.
      const commandOutput = `> repro@0.0.1 prepublishOnly
> echo scaffold

generated a 12" template
{
  "id": "repro@0.0.1",
  "name": "repro",
  "version": "0.0.1",
  "size": 300,
  "unpackedSize": 200,
  "shasum": "cf4a6657f230ddf5375102bafc8f5184002a620a",
  "integrity": "sha512-Qra/YIkAxVavs3tumB/svugHLY5CISujdeUcMd2FfvtVkjEEsVAEYbqZTq0ixnkvjVrLr27mAvH94GjjMKWzIg==",
  "filename": "repro-0.0.1.tgz",
  "files": [
    {
      "path": "package.json",
      "size": 200,
      "mode": 420
    }
  ],
  "entryCount": 1,
  "bundled": []
}`;
      const res = extractNpmPublishJsonData(commandOutput);

      expect(res.beforeJsonData).toMatchInlineSnapshot(`
        "> repro@0.0.1 prepublishOnly
        > echo scaffold

        generated a 12" template
        "
      `);
      expect(res.jsonData).toMatchInlineSnapshot(`
        {
          "bundled": [],
          "entryCount": 1,
          "filename": "repro-0.0.1.tgz",
          "files": [
            {
              "mode": 420,
              "path": "package.json",
              "size": 200,
            },
          ],
          "id": "repro@0.0.1",
          "integrity": "sha512-Qra/YIkAxVavs3tumB/svugHLY5CISujdeUcMd2FfvtVkjEEsVAEYbqZTq0ixnkvjVrLr27mAvH94GjjMKWzIg==",
          "name": "repro",
          "shasum": "cf4a6657f230ddf5375102bafc8f5184002a620a",
          "size": 300,
          "unpackedSize": 200,
          "version": "0.0.1",
        }
      `);
      expect(res.afterJsonData).toMatchInlineSnapshot(`""`);
    });

    it('should extract the summary when a files[].path uses backslash-escaped separators', () => {
      // A Windows-style path escapes its separators as \\ and can include braces;
      // the escape handling must not mis-terminate the surrounding string value.
      const commandOutput = `{
  "id": "repro@0.0.1",
  "name": "repro",
  "version": "0.0.1",
  "size": 300,
  "unpackedSize": 200,
  "shasum": "cf4a6657f230ddf5375102bafc8f5184002a620a",
  "integrity": "sha512-Qra/YIkAxVavs3tumB/svugHLY5CISujdeUcMd2FfvtVkjEEsVAEYbqZTq0ixnkvjVrLr27mAvH94GjjMKWzIg==",
  "filename": "repro-0.0.1.tgz",
  "files": [
    {
      "path": "templates\\\\{{name}}\\\\file.txt",
      "size": 6,
      "mode": 420
    }
  ],
  "entryCount": 1,
  "bundled": []
}`;
      const res = extractNpmPublishJsonData(commandOutput);

      expect(res.beforeJsonData).toMatchInlineSnapshot(`""`);
      expect(res.jsonData).toMatchInlineSnapshot(`
        {
          "bundled": [],
          "entryCount": 1,
          "filename": "repro-0.0.1.tgz",
          "files": [
            {
              "mode": 420,
              "path": "templates\\{{name}}\\file.txt",
              "size": 6,
            },
          ],
          "id": "repro@0.0.1",
          "integrity": "sha512-Qra/YIkAxVavs3tumB/svugHLY5CISujdeUcMd2FfvtVkjEEsVAEYbqZTq0ixnkvjVrLr27mAvH94GjjMKWzIg==",
          "name": "repro",
          "shasum": "cf4a6657f230ddf5375102bafc8f5184002a620a",
          "size": 300,
          "unpackedSize": 200,
          "version": "0.0.1",
        }
      `);
      expect(res.afterJsonData).toMatchInlineSnapshot(`""`);
    });

    it('should still extract the summary when lifecycle output contains comment-like text or globs', () => {
      // Lifecycle scripts print arbitrary text, including paths and globs such as
      // "dist/*.js" or a "// build" line. These are not JSON comments and must not
      // hide the summary that follows.
      const commandOutput = `> repro@0.0.1 prepublishOnly
> node ./scripts/build.js

emitting dist/*.js and dist/**/*.d.ts
// build complete
{
  "id": "repro@0.0.1",
  "name": "repro",
  "version": "0.0.1",
  "size": 300,
  "unpackedSize": 200,
  "shasum": "cf4a6657f230ddf5375102bafc8f5184002a620a",
  "integrity": "sha512-Qra/YIkAxVavs3tumB/svugHLY5CISujdeUcMd2FfvtVkjEEsVAEYbqZTq0ixnkvjVrLr27mAvH94GjjMKWzIg==",
  "filename": "repro-0.0.1.tgz",
  "files": [
    {
      "path": "package.json",
      "size": 200,
      "mode": 420
    }
  ],
  "entryCount": 1,
  "bundled": []
}`;
      const res = extractNpmPublishJsonData(commandOutput);

      expect(res.beforeJsonData).toMatchInlineSnapshot(`
        "> repro@0.0.1 prepublishOnly
        > node ./scripts/build.js

        emitting dist/*.js and dist/**/*.d.ts
        // build complete
        "
      `);
      expect(res.jsonData).toMatchInlineSnapshot(`
        {
          "bundled": [],
          "entryCount": 1,
          "filename": "repro-0.0.1.tgz",
          "files": [
            {
              "mode": 420,
              "path": "package.json",
              "size": 200,
            },
          ],
          "id": "repro@0.0.1",
          "integrity": "sha512-Qra/YIkAxVavs3tumB/svugHLY5CISujdeUcMd2FfvtVkjEEsVAEYbqZTq0ixnkvjVrLr27mAvH94GjjMKWzIg==",
          "name": "repro",
          "shasum": "cf4a6657f230ddf5375102bafc8f5184002a620a",
          "size": 300,
          "unpackedSize": 200,
          "version": "0.0.1",
        }
      `);
      expect(res.afterJsonData).toMatchInlineSnapshot(`""`);
    });

    it('should unwrap the nested summary when a files[].path contains curly braces', () => {
      // Combines the npm >= 11.16 / pnpm nesting under the package name with a
      // brace-carrying file path, exercising the unwrap and scanner together.
      const commandOutput = `{
  "@scope/repro": {
    "id": "@scope/repro@0.0.1",
    "name": "@scope/repro",
    "version": "0.0.1",
    "size": 300,
    "unpackedSize": 200,
    "shasum": "cf4a6657f230ddf5375102bafc8f5184002a620a",
    "integrity": "sha512-Qra/YIkAxVavs3tumB/svugHLY5CISujdeUcMd2FfvtVkjEEsVAEYbqZTq0ixnkvjVrLr27mAvH94GjjMKWzIg==",
    "filename": "scope-repro-0.0.1.tgz",
    "files": [
      {
        "path": "templates/{{name}}/file.txt",
        "size": 6,
        "mode": 420
      }
    ],
    "entryCount": 1,
    "bundled": []
  }
}`;
      const res = extractNpmPublishJsonData(commandOutput);

      expect(res.beforeJsonData).toMatchInlineSnapshot(`""`);
      expect(res.jsonData).toMatchInlineSnapshot(`
        {
          "bundled": [],
          "entryCount": 1,
          "filename": "scope-repro-0.0.1.tgz",
          "files": [
            {
              "mode": 420,
              "path": "templates/{{name}}/file.txt",
              "size": 6,
            },
          ],
          "id": "@scope/repro@0.0.1",
          "integrity": "sha512-Qra/YIkAxVavs3tumB/svugHLY5CISujdeUcMd2FfvtVkjEEsVAEYbqZTq0ixnkvjVrLr27mAvH94GjjMKWzIg==",
          "name": "@scope/repro",
          "shasum": "cf4a6657f230ddf5375102bafc8f5184002a620a",
          "size": 300,
          "unpackedSize": 200,
          "version": "0.0.1",
        }
      `);
      expect(res.afterJsonData).toMatchInlineSnapshot(`""`);
    });
  });
});
