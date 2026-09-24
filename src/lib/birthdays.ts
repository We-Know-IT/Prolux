// Next occurrence of a birthday (YYYY-MM-DD) from `today`, in whole days.
// 29 February is celebrated on 28 February in non-leap years.
export function nextBirthday(birthday: string, today = new Date()) {
  const [by, bm, bd] = birthday.split('-').map(Number)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const on = (y: number) => {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
    return new Date(y, bm - 1, bm === 2 && bd === 29 && !leap ? 28 : bd)
  }
  let next = on(start.getFullYear())
  if (next < start) next = on(start.getFullYear() + 1)
  return {
    date: next,
    daysUntil: Math.round((next.getTime() - start.getTime()) / 86400000),
    turns: by > 1900 ? next.getFullYear() - by : null,
  }
}

export function formatBirthday(birthday: string) {
  const [, m, d] = birthday.split('-').map(Number)
  return `${d} ${['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][m - 1]}`
}
