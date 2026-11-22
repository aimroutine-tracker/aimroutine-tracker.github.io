const DAY_MS = 86_400_000;

function calendarDay(timestamp) {
  const offsetMinutes = new Date(timestamp).getTimezoneOffset();
  return Math.floor((timestamp - offsetMinutes * 60_000) / DAY_MS);
}

// Bucket boundaries represent local calendar dates encoded at UTC midnight.
export function progressPeriod(history, days, now = new Date()) {
  const today = calendarDay(now.getTime());
  const firstVisibleDay = days ? today - days + 1 : -Infinity;
  const dated = [];
  for (const session of history) {
    const timestamp = Date.parse(session.date);
    if (!Number.isFinite(timestamp) || timestamp > now.getTime()) continue;
    const day = calendarDay(timestamp);
    if (day >= firstVisibleDay) dated.push({session, day});
  }
  if (!dated.length) return {sessions: [], buckets: []};

  const dates = dated.map(entry => entry.day);
  const startDay = days ? firstVisibleDay : Math.min(...dates);
  const endDay = days ? today : Math.max(...dates);
  const span = endDay - startDay + 1;
  const bucketSize = Math.ceil(span / 7);
  const buckets = Array.from({length: Math.ceil(span / bucketSize)}, (_, index) => {
    const start = startDay + index * bucketSize;
    return {
      start: new Date(start * DAY_MS),
      end: new Date(Math.min(start + bucketSize - 1, endDay) * DAY_MS),
      count: 0
    };
  });
  for (const {day} of dated) buckets[Math.floor((day - startDay) / bucketSize)].count++;
  return {sessions: dated.map(entry => entry.session), buckets};
}

function scenarioValue(tool, name) {
  return JSON.stringify([tool, name]);
}

export function progressScenarioOptions(history, tool = '') {
  const options = new Map();
  for (const session of history) {
    const name = session.scenario?.trim();
    if (!name || (tool && session.tool !== tool)) continue;
    const value = scenarioValue(session.tool, name);
    options.set(value, {value, name, tool: session.tool});
  }
  return [...options.values()];
}

export function filterProgressSessions(history, tool, scenario) {
  return history.filter(session =>
    (!tool || session.tool === tool) &&
    (!scenario || scenarioValue(session.tool, session.scenario?.trim()) === scenario)
  );
}
