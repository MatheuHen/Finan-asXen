export function parseDateOnly(dateString: string) {
  const [yearStr, monthStr, dayStr] = dateString.split("-")
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)

  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

export function formatDateOnly(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function addMonthsClamped(date: Date, months: number) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()

  const firstOfTargetMonth = new Date(year, month + months, 1)
  const lastDay = new Date(
    firstOfTargetMonth.getFullYear(),
    firstOfTargetMonth.getMonth() + 1,
    0
  ).getDate()

  return new Date(
    firstOfTargetMonth.getFullYear(),
    firstOfTargetMonth.getMonth(),
    Math.min(day, lastDay)
  )
}
