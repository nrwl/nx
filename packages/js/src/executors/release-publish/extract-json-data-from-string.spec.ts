import { extractJsonDataFromString } from './extract-json-data-from-string';

describe('extractJsonDataFromString()', () => {
  describe('pure JSON data', () => {
    const data = {
      foo: true,
      bar: [1, 2, 3],
    };

    it('should extract JSON data from a string containing only formatted JSON data', () => {
      const data = {
        foo: true,
        bar: [1, 2, 3],
      };
      const formattedJsonStr = JSON.stringify(data, null, 2);
      const res = extractJsonDataFromString(formattedJsonStr);
      expect(res.beforeJsonData).toEqual('');
      expect(res.jsonData).toEqual(data);
      expect(res.afterJsonData).toEqual('');
    });

    it('should extract JSON data from a string containing only unformatted JSON data', () => {
      const unformattedJsonStr = JSON.stringify(data);
      const res = extractJsonDataFromString(unformattedJsonStr);
      expect(res.beforeJsonData).toEqual('');
      expect(res.jsonData).toEqual(data);
      expect(res.afterJsonData).toEqual('');
    });
  });

  describe('mixed JSON and non-JSON data', () => {
    const data = {
      foo: true,
      bar: [1, 2, 3],
    };
    const extraContentBefore = 'Some random text';
    const extraContentAfter = 'More random text';

    it('should extract JSON data containing mixed data including formatted JSON data', () => {
      const formattedJsonStr = JSON.stringify(data, null, 2);
      const res = extractJsonDataFromString(`${extraContentBefore}
${formattedJsonStr}
${extraContentAfter}`);
      expect(res.beforeJsonData).toEqual(extraContentBefore);
      expect(res.jsonData).toEqual(data);
      expect(res.afterJsonData).toEqual(extraContentAfter);
    });

    it('should error on a string containing mixed data including unformatted JSON data', () => {
      const unformattedJsonStr = JSON.stringify(data);
      expect(() =>
        extractJsonDataFromString(`${extraContentBefore}
${unformattedJsonStr}
${extraContentAfter}`)
      ).toThrowErrorMatchingInlineSnapshot(
        `"Failed to parse a valid JSON string within the command output"`
      );
    });

    it('should extract JSON data from a realistic publish output string containing mixed data including formatted JSON data', () => {
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
      const res = extractJsonDataFromString(
        exampleCommandOutputWithLifecycleScripts
      );

      expect(res.beforeJsonData).toMatchInlineSnapshot(`
        "
        > package-a@1.0.0 prepublishOnly
        > echo 'prepublishOnly from package-a'

        prepublishOnly from package-a"
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

      expect(res.afterJsonData).toEqual('');
    });
  });
});
