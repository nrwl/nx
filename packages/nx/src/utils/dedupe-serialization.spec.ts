import { serialize, serializeWithFallback } from '../daemon/socket-utils';
import { parseMessage } from './consume-messages-from-socket';
import {
  DEDUPE_MARKER,
  decodeDeduped,
  encodeAuto,
  isDedupedPayload,
} from './dedupe-serialization';

function taskGraphLike(tasks = 50, inputs = 200) {
  const nodes: Record<string, string> = {};
  for (let i = 0; i < inputs; i++)
    nodes[`workspace:lib/src/file-${i}.ts`] = 'abc123';
  const out: Record<string, unknown> = {};
  for (let t = 0; t < tasks; t++) {
    out[`p${t}:build`] = {
      id: `p${t}:build`,
      target: { project: `p${t}`, target: 'build' },
      outputs: [`dist/p${t}`],
      hash: `hash-${t}`,
      hashDetails: { command: 'build', nodes: { ...nodes, unique: `${t}` } },
    };
  }
  return { tasks: out, roots: Object.keys(out), dependencies: {} };
}

describe('encodeAuto', () => {
  it('passes tiny payloads through', () => {
    expect(encodeAuto({ type: 'PING', a: 'b' })).toBeUndefined();
  });

  it('bails when refs per container is low, before walking everything', () => {
    // Project-graph shaped: thousands of three-field edge objects.
    const edges = Array.from({ length: 6000 }, (_, i) => ({
      source: `p${i}`,
      target: `p${i + 1}`,
      type: 'static',
    }));
    expect(encodeAuto({ edges })).toBeUndefined();
  });

  it('dedupes a dense payload and round-trips it exactly', () => {
    const input = taskGraphLike();
    const payload = encodeAuto(input);
    expect(payload).toBeDefined();
    expect(isDedupedPayload(payload)).toBe(true);
    expect(decodeDeduped(payload)).toEqual(input);
  });

  it('preserves property order', () => {
    const input = taskGraphLike(30, 200);
    const nodes = (input.tasks['p1:build'] as any).hashDetails.nodes;
    const decoded = decodeDeduped<typeof input>(encodeAuto(input));
    expect(
      Object.keys((decoded.tasks['p1:build'] as any).hashDetails.nodes)
    ).toEqual(Object.keys(nodes));
    expect(Object.keys(decoded.tasks)).toEqual(Object.keys(input.tasks));
  });

  it('interns shapes that share a prefix without rescanning them', () => {
    // One key per task appended to a shared list: every task is its own
    // shape, and all of them share a first key and a length.
    const input = taskGraphLike(400, 100) as any;
    for (const id in input.tasks) {
      input.tasks[id].hashDetails.nodes[`workspace:${id}/index.ts`] = 'own';
    }
    const payload = encodeAuto(input);
    expect(payload.shapes.length).toBeGreaterThanOrEqual(400);
    expect(decodeDeduped(payload)).toEqual(input);
  });

  it('keeps prefix-related key lists as distinct shapes', () => {
    // nodes maps that are strict prefixes of one another, plus the reverse
    // order, so shapes sharing keys differ only by length or by position.
    const files = Array.from({ length: 300 }, (_, i) => `workspace:f${i}.ts`);
    const input = taskGraphLike(300, 1) as any;
    Object.keys(input.tasks).forEach((id, t) => {
      const nodes: Record<string, string> = {};
      const keys =
        t % 2 ? files.slice(0, t + 1) : files.slice(0, t + 1).reverse();
      for (const k of keys) nodes[k] = 'h';
      input.tasks[id].hashDetails.nodes = nodes;
    });
    const payload = encodeAuto(input);
    expect(payload).toBeDefined();
    expect(decodeDeduped(payload)).toEqual(input);
    expect(payload.shapes.length).toBeGreaterThanOrEqual(300);
  });

  it('interns one shape per distinct key list', () => {
    const payload = encodeAuto(taskGraphLike(40, 100));
    // 40 tasks share the task shape, the target shape and the nodes shape.
    expect(payload.shapes.length).toBeLessThan(12);
  });

  it('matches JSON on undefined: dropped in objects, null in arrays', () => {
    const input = taskGraphLike(10, 300) as any;
    input.tasks['p0:build'].overrides = { keep: 'x', drop: undefined };
    input.tasks['p0:build'].outputs = ['a', undefined, 'b'];
    const decoded = decodeDeduped(encodeAuto(input));
    expect(decoded).toEqual(JSON.parse(JSON.stringify(input)));
  });

  it.each([
    ['a function', () => {}],
    ['a symbol', Symbol('s')],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['-0', -0],
    ['true', true],
    ['null', null],
    ['a finite number', 1.5],
  ])(
    'matches JSON on %s as an object value and as an array element',
    (_, value) => {
      const input = taskGraphLike(10, 300) as any;
      input.tasks['p0:build'].overrides = { keep: 'x', value };
      input.tasks['p0:build'].outputs = ['a', value, 'b'];
      const decoded = decodeDeduped<any>(encodeAuto(input));
      expect(decoded).toEqual(JSON.parse(JSON.stringify(input)));
      const out = decoded.tasks['p0:build'].outputs[1];
      expect(Object.is(out, -0)).toBe(false);
    }
  );

  it('matches JSON on array holes', () => {
    const input = taskGraphLike(10, 300) as any;
    input.tasks['p0:build'].outputs = ['a', , 'b'];
    input.tasks['p0:build'].outputs.length = 5;
    const decoded = decodeDeduped<any>(encodeAuto(input));
    expect(decoded.tasks['p0:build'].outputs).toEqual([
      'a',
      null,
      'b',
      null,
      null,
    ]);
  });

  it('keeps a bigint, where JSON would have thrown and v8 taken over', () => {
    const input = taskGraphLike(10, 300) as any;
    input.tasks['p0:build'].overrides = { big: 10n };
    expect(
      parseMessage<any>(serialize(input)).tasks['p0:build'].overrides
    ).toEqual({ big: 10n });
  });

  it('bails on a long list of unique strings, which has nothing to dedupe', () => {
    const configFiles = Array.from(
      { length: 20000 },
      (_, i) => `libs/lib${i % 600}/src/file${i}.ts`
    );
    expect(encodeAuto({ type: 'createNodes', configFiles })).toBeUndefined();
  });

  it('bails on a cycle so v8 serialization handles it', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const input = taskGraphLike(10, 300) as any;
    input.tasks['p0:build'].overrides = { graph: input };
    expect(encodeAuto(input)).toBeUndefined();
    const decoded = parseMessage<any>(serialize(input));
    expect(decoded.tasks['p0:build'].overrides.graph).toBe(decoded);
  });

  it('keeps an own __proto__ key on both decode paths', () => {
    const input = taskGraphLike(10, 300) as any;
    const small = JSON.parse('{"__proto__": "small", "k": "v"}');
    const big = JSON.parse('{"__proto__": "big"}');
    for (let i = 0; i < 70; i++) big[`k${i}`] = 'v';
    input.tasks['p0:build'].overrides = { small, big };
    const out = decodeDeduped<any>(encodeAuto(input)).tasks['p0:build']
      .overrides;
    expect(Object.getOwnPropertyDescriptor(out.small, '__proto__').value).toBe(
      'small'
    );
    expect(Object.getOwnPropertyDescriptor(out.big, '__proto__').value).toBe(
      'big'
    );
    expect(Object.getPrototypeOf(out.small)).toBe(Object.prototype);
  });

  it.each([
    ['a Date', new Date()],
    ['a Buffer', Buffer.from('x')],
    ['a Map', new Map()],
    ['a class instance', new (class Foo {})()],
    ['an object with toJSON', { toJSON: () => 'x' }],
  ])('bails on %s so the existing path handles it', (_, value) => {
    const input = taskGraphLike(10, 300) as any;
    input.tasks['p0:build'].overrides = { value };
    expect(encodeAuto(input)).toBeUndefined();
  });

  it('decodes to plain objects, including large ones built in dictionary mode', () => {
    const decoded = decodeDeduped<any>(encodeAuto(taskGraphLike(20, 200)));
    const nodes = decoded.tasks['p0:build'].hashDetails.nodes;
    expect(Object.getPrototypeOf(nodes)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(nodes, 'unique')).toBe(true);
    expect(Object.keys(nodes)).toHaveLength(201);
  });
});

describe('serialize() with automatic dedupe', () => {
  it('round-trips a dense payload through parseMessage and shrinks it', () => {
    const input = taskGraphLike();
    const bytes = serialize(input);
    expect(bytes[0]).toBe(0xff); // v8 envelope
    expect(bytes.length).toBeLessThan(JSON.stringify(input).length / 3);
    expect(parseMessage(bytes)).toEqual(input);
  });

  it('leaves low-density payloads on the existing path', () => {
    const bytes = serialize({ type: 'REQUEST_PROJECT_GRAPH', small: true });
    expect(bytes[0]).not.toBe(0xff);
    expect(parseMessage(bytes)).toEqual({
      type: 'REQUEST_PROJECT_GRAPH',
      small: true,
    });
  });

  it.each(['json', 'v8'] as const)(
    'dedupes a dense payload on the fallback path when %s is preferred',
    (preferred) => {
      // The daemon server replies through this path in the client's format.
      const input = taskGraphLike();
      const bytes = serializeWithFallback(input, preferred);
      expect(bytes[0]).toBe(0xff);
      expect(bytes.length).toBeLessThan(JSON.stringify(input).length / 3);
      expect(parseMessage(bytes)).toEqual(input);
    }
  );

  it('decodes a string table whichever format carried it', () => {
    const input = taskGraphLike();
    const asJson = Buffer.from(JSON.stringify(encodeAuto(input)));
    expect(parseMessage(asJson)).toEqual(input);
  });

  it('respects a forced format', () => {
    const input = taskGraphLike();
    const bytes = serialize(input, 'json');
    expect(bytes[0]).toBe('{'.charCodeAt(0));
    expect(parseMessage(bytes)).toEqual(input);
    expect(DEDUPE_MARKER in (parseMessage(serialize(input, 'v8')) as any)).toBe(
      false
    );
  });
});
