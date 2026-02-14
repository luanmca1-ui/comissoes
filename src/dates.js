export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function getWeekBounds(baseDate = new Date()) {
  const date = new Date(baseDate);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    fromISO: monday.toISOString().slice(0, 10),
    toISO: sunday.toISOString().slice(0, 10),
  };
}