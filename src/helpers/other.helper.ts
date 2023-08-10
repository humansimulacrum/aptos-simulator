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

// add name generator
// async function buyAns(account: AptosAccount, client: AptosClient): Promise<string> {
//   const APTbalance = await getTokenBalance(tokenList[0].address, account, client);
//   if (APTbalance < 1.4) {
//     return 'error';
//   } else {
//     const ans = new AnsClient(new Provider('mainnet' as Network));
//     const max_gas_amount = await client.estimateMaxGasAmount(account.address());
//     return await ans.mintAptosName(account, 'name', 1, { maxGasAmount: max_gas_amount });
//   }
// }
