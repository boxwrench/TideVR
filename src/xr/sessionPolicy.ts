export function selectQuestFrameRate(
  supportedFrameRates: ArrayLike<number>,
): number | false {
  return Array.from(supportedFrameRates).includes(72) ? 72 : false
}

export function shouldEnableXrEmulator(
  isDevelopment: boolean,
  search: string,
): boolean {
  return (
    isDevelopment &&
    new URLSearchParams(search).get('emulate') === '1'
  )
}
