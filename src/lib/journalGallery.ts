/** Calendar grouping uses the viewer's local date, consistently with the journal editor. */
export function calendarDate(value: string) {
 if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
 const date = new Date(value)
 if (!Number.isFinite(date.getTime())) return ''
 return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function matchesCalendar(value: string, year: string, month: string, day: string) {
 const date = calendarDate(value)
 return (!year || date.slice(0, 4) === year) && (!month || date.slice(5, 7) === month) && (!day || date.slice(8, 10) === day)
}
export function calendarGroup(value: string, scale: 'year' | 'month' | 'day') {
 const date = calendarDate(value)
 return date ? date.slice(0, scale === 'year' ? 4 : scale === 'month' ? 7 : 10) : '날짜 미제공'
}
