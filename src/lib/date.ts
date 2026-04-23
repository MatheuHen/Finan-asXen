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

export function isISODateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function isBRDateOnly(value: string) {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(value)
}

export function normalizeDateOnlyToISO(input: string) {
  const raw = input.trim()
  if (raw.length === 0) return null

  if (isISODateOnly(raw)) {
    const parsed = parseDateOnly(raw)
    if (!parsed) return null
    return formatDateOnly(parsed) === raw ? raw : null
  }

  if (isBRDateOnly(raw)) {
    const [day, month, year] = raw.split("/")
    const iso = `${year}-${month}-${day}`
    const parsed = parseDateOnly(iso)
    if (!parsed) return null
    return formatDateOnly(parsed) === iso ? iso : null
  }

  return null
}

export function formatDateOnlyBR(date: Date) {
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = String(date.getFullYear())
  return `${day}/${month}/${year}`
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
