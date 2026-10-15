export function formatDate(value: string) {
  const date = new Date(value + "T00:00:00+05:30");
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date)
    : value;
}
