/**
 * All credit to https://github.com/jonschlinkert/pretty-time
 */

const nano = (time: [number, number]) => +time[0] * 1e9 + +time[1];

const scale: Record<string, number> = {
  w: 6048e11,
  d: 864e11,
  h: 36e11,
  m: 6e10,
  s: 1e9,
  ms: 1e6,
  μs: 1e3,
  ns: 1,
};

const regex: Record<string, RegExp> = {
  w: /^(w((ee)?k)?s?)$/,
  d: /^(d(ay)?s?)$/,
  h: /^(h((ou)?r)?s?)$/,
  m: /^(min(ute)?s?|m)$/,
  s: /^((sec(ond)?)s?|s)$/,
  ms: /^(milli(second)?s?|ms)$/,
  μs: /^(micro(second)?s?|μs)$/,
  ns: /^(nano(second)?s?|ns?)$/,
};

const isSmallest = function (uom: string, unit: string) {
  return regex[uom].test(unit);
};

const round = function (
  num: number,
  digits: number | string | null | undefined
) {
  const n = Math.abs(num);
  return /[0-9]/.test(String(digits))
    ? Number(n.toFixed(Number(digits)))
    : Math.round(n);
};

export function prettyTime(
  time: number | [number, number],
  smallest?: string | null,
  digits?: number | string | null
) {
  const isNumber = /^[0-9]+$/.test(String(time));
  if (!isNumber && !Array.isArray(time)) {
    throw new TypeError('expected an array or number in nanoseconds');
  }
  if (Array.isArray(time) && time.length !== 2) {
    throw new TypeError('expected an array from process.hrtime()');
  }

  if (/^[0-9]+$/.test(String(smallest))) {
    digits = smallest;
    smallest = null;
  }

  let num = Array.isArray(time) ? nano(time) : time;
  let res = '';
  let prev: number | undefined;

  for (const uom of Object.keys(scale)) {
    const step = scale[uom];
    let inc = num / step;

    if (smallest && isSmallest(uom, smallest)) {
      inc = round(inc, digits);
      if (prev && inc === prev / step) --inc;
      res += inc + uom;
      return res.trim();
    }

    if (inc < 1) continue;
    if (!smallest) {
      inc = round(inc, digits);
      res += inc + uom;
      return res;
    }

    prev = step;

    inc = Math.floor(inc);
    num -= inc * step;
    res += inc + uom + ' ';
  }

  return res.trim();
}
