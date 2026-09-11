import { serialize } from '../daemon/socket-utils';
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
