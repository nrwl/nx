/**
 * All credit to https://github.com/jonschlinkert/pretty-time
 */

const nano = (time) => +time[0] * 1e9 + +time[1];

const scale = {
  w: 6048e11,
  d: 864e11,
  h: 36e11,
  m: 6e10,
  s: 1e9,
  ms: 1e6,
  μs: 1e3,
  ns: 1,
};

const regex = {
  w: /^(w((ee)?k)?s?)$/,
  d: /^(d(ay)?s?)$/,
  h: /^(h((ou)?r)?s?)$/,
  m: /^(min(ute)?s?|m)$/,
  s: /^((sec(ond)?)s?|s)$/,
  ms: /^(milli(second)?s?|ms)$/,
  μs: /^(micro(second)?s?|μs)$/,
  ns: /^(nano(second)?s?|ns?)$/,
};

const isSmallest = function (uom, unit) {
  return regex[uom].test(unit);
};

const round = function (num, digits) {
  const n = Math.abs(num);
  return /[0-9]/.test(digits) ? Number(n.toFixed(digits)) : Math.round(n);
};

export function prettyTime(time, smallest?, digits?) {
  const isNumber = /^[0-9]+$/.test(time);
  if (!isNumber && !Array.isArray(time)) {
    throw new TypeError('expected an array or number in nanoseconds');
  }
  if (Array.isArray(time) && time.length !== 2) {
    throw new TypeError('expected an array from process.hrtime()');
  }

  if (/^[0-9]+$/.test(smallest)) {
    digits = smallest;
    smallest = null;
  }

  let num = isNumber ? time : nano(time);
  let res = '';
  let prev;

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
