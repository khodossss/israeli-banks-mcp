// Calendar days in transaction filters are Israeli days. Banks store a
// transaction's day as Israeli local midnight in UTC ("2026-10-31T22:00:00.000Z"
// is 1 Nov), so a bare "YYYY-MM-DD" must become that instant before comparing.

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Jerusalem',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

// UTC instant of Israeli midnight starting `day`. DST switches happen at 02:00,
// never at midnight, so the offset read at UTC midnight of that day holds.
function israelMidnight(day) {
  const utc = new Date(`${day}T00:00:00Z`);
  const p = Object.fromEntries(parts.formatToParts(utc).map(x => [x.type, x.value]));
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return new Date(utc.getTime() - (wall - utc.getTime()));
}

// { lo, hi } for `lo <= date < hi`. `from`/`to` are inclusive Israeli days;
// full ISO instants pass through unchanged (then `to` stays an inclusive bound).
export function dayRange(from, to) {
  const lo = !from ? null : DAY.test(from) ? israelMidnight(from).toISOString() : from;
  let hi = null;
  if (to) {
    if (DAY.test(to)) {
      const next = new Date(`${to}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      hi = israelMidnight(next.toISOString().slice(0, 10)).toISOString();
    } else {
      hi = `${to}￿`; // an instant: keep it inclusive under the strict `<`
    }
  }
  return { lo, hi };
}

export function inRange(date, { lo, hi }) {
  return (!lo || (date && date >= lo)) && (!hi || (date && date < hi));
}

// Today's date in Israel, "YYYY-MM-DD".
export function israelToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(now);
}
