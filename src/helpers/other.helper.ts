export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export function calculatePercentage(number: number, percentage: number): number {
  const result = (number * percentage) / 100;
  return Math.floor(result);
}

export function addHoursAndGetSeconds(hours: number): bigint {
  const currentTimeMillis = Date.now();
  const hoursInMillis = BigInt(hours) * BigInt(60) * BigInt(60) * BigInt(1000);
  const futureTimeMillis = BigInt(currentTimeMillis) + hoursInMillis;
  const futureTimeSeconds = futureTimeMillis / BigInt(1000);
  return futureTimeSeconds;
}
