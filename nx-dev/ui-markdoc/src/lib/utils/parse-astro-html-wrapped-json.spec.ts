import { parseAstroHtmlWrappedJson } from './parse-astro-html-wrapped-json';

describe('parseAstroHtmlWrappedJson', () => {
  describe('with data-code attribute', () => {
    it('should parse JSON with escaped quotes in command field', () => {
      const htmlString = `<div class="expressive-code">
        <button data-code="{&#x22;project&#x22;: {&#x22;name&#x22;: &#x22;test&#x22;, &#x22;command&#x22;: &#x22;\\&#x22;hello\\&#x22;&#x22;}}" />
      </div>`;

      const result = parseAstroHtmlWrappedJson(htmlString);

      expect(result).toEqual({
        project: {
          name: 'test',
          command: '"hello"',
        },
      });
    });

    it('should handle various HTML entity encodings', () => {
      const htmlString = `<button data-code="{&quot;test&quot;: &quot;value&quot;, &#x22;&amp;key&amp;&#x22;: &#x22;&lt;test&gt;&#x22;, &#x22;&#39;single&#39;&#x22;: &#x22;&#x27;quote&#x27;&#x22;}" />`;

      const result = parseAstroHtmlWrappedJson(htmlString);

      expect(result).toEqual({
        test: 'value',
        '&key&': '<test>',
        "'single'": "'quote'",
      });
    });

    it('should handle complex nested JSON with escaped quotes', () => {
      const htmlString = `<div data-code="{&#x22;project&#x22;: {&#x22;targets&#x22;: {&#x22;e2e-ci--src/e2e/login.cy.ts&#x22;: {&#x22;options&#x22;: {&#x22;command&#x22;: &#x22;cypress run --env webServerCommand=\\&#x22;nx run admin:serve-static\\&#x22; --spec src/e2e/login.cy.ts&#x22;}}}}}" />`;

      const result = parseAstroHtmlWrappedJson(htmlString);

      expect(result).toEqual({
        project: {
          targets: {
            'e2e-ci--src/e2e/login.cy.ts': {
              options: {
                command:
                  'cypress run --env webServerCommand="nx run admin:serve-static" --spec src/e2e/login.cy.ts',
              },
            },
          },
        },
      });
    });

    it('should remove Unicode replacement characters (U+FFFD)', () => {
      const htmlString = `<button data-code="{&#x22;test&#x22;: &#x22;value�with�replacement�chars&#x22;}" />`;

      const result = parseAstroHtmlWrappedJson(htmlString);

      expect(result).toEqual({
        test: 'valuewithreplacementchars',
      });
    });

    it('should handle backslash encoding', () => {
      const htmlString = `<button data-code="{&#x22;path&#x22;: &#x22;C:&#x5C;&#x5C;Users&#x5C;&#x5C;test&#x22;}" />`;

      const result = parseAstroHtmlWrappedJson(htmlString);

      expect(result).toEqual({
        path: 'C:\\Users\\test',
      });
    });

    it('should handle non-breaking spaces', () => {
      const htmlString = `<button data-code="{&#x22;text&#x22;: &#x22;hello&nbsp;world&#x22;}" />`;

      const result = parseAstroHtmlWrappedJson(htmlString);

      expect(result).toEqual({
        text: 'hello world',
      });
    });

    it('should handle all HTML entity variations for quotes', () => {
      const variations = [
        `<button data-code="{&quot;test&quot;: &quot;named&quot;}" />`,
        `<button data-code="{&#34;test&#34;: &#34;decimal&#34;}" />`,
        `<button data-code="{&#x22;test&#x22;: &#x22;hexadecimal&#x22;}" />`,
      ];

      variations.forEach((html, index) => {
        const result = parseAstroHtmlWrappedJson(html);
        expect(result.test).toBeDefined();
      });
    });
  });

  describe('fallback parsing (without data-code)', () => {
    it('should parse simple JSON without HTML wrapper', () => {
      const jsonString = '{"test": "value"}';

      const result = parseAstroHtmlWrappedJson(jsonString);

      expect(result).toEqual({
        test: 'value',
      });
    });

    it('should handle HTML entity encoding in fallback mode', () => {
      const jsonString = '{&quot;test&quot;: &quot;value&quot;}';

      const result = parseAstroHtmlWrappedJson(jsonString);

      expect(result).toEqual({
        test: 'value',
      });
    });

    it('should strip single-letter HTML tags', () => {
      const jsonString = '<p>{"test": "value"}</p>';

      const result = parseAstroHtmlWrappedJson(jsonString);

      expect(result).toEqual({
        test: 'value',
      });
    });
  });

  describe('real-world examples', () => {
    it('should handle the actual Cypress atomizer output structure', () => {
      const htmlString = `<div class="expressive-code"><button data-code="{&#x22;project&#x22;: {&#x22;name&#x22;: &#x22;admin-e2e&#x22;, &#x22;data&#x22;: {&#x22;targets&#x22;: {&#x22;e2e-ci--src/e2e/login.cy.ts&#x22;: {&#x22;outputs&#x22;: [], &#x22;inputs&#x22;: [], &#x22;options&#x22;: {&#x22;command&#x22;: &#x22;\\&#x22;hello\\&#x22;&#x22;}, &#x22;executor&#x22;: &#x22;nx:run-commands&#x22;}}, &#x22;name&#x22;: &#x22;admin-e2e&#x22;}}, &#x22;sourceMap&#x22;: {}}" /></div>`;

      const result = parseAstroHtmlWrappedJson(htmlString);

      expect(result).toEqual({
        project: {
          name: 'admin-e2e',
          data: {
            targets: {
              'e2e-ci--src/e2e/login.cy.ts': {
                outputs: [],
                inputs: [],
                options: {
                  command: '"hello"',
                },
                executor: 'nx:run-commands',
              },
            },
            name: 'admin-e2e',
          },
        },
        sourceMap: {},
      });
    });

    it('should handle complex Cypress commands with nested quotes', () => {
      const htmlString = `<div data-code="{&#x22;options&#x22;: {&#x22;command&#x22;: &#x22;cypress run --env webServerCommand=\\&#x22;nx run admin:serve-static\\&#x22; --spec src/e2e/app.cy.ts&#x22;}}" />`;

      const result = parseAstroHtmlWrappedJson(htmlString);

      expect(result).toEqual({
        options: {
          command:
            'cypress run --env webServerCommand="nx run admin:serve-static" --spec src/e2e/app.cy.ts',
        },
      });
    });
  });
});
