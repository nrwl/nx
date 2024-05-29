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
  });
});
