export function creditsToHours(credits) {
  return Number(((credits * 45) / 60).toFixed(2))
}
