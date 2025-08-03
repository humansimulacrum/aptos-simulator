import { Account, Aptos } from '@aptos-labs/ts-sdk';

export async function getTokenBalance(token: string, account: Account, client: Aptos): Promise<number> {
  const resources = await client.getCurrentFungibleAssetBalances({
    options: { where: { asset_type: { _eq: token }, owner_address: { _eq: account.accountAddress.toString() } } },
  });

  const record = resources[0];

  if (!record) {
    console.warn('Token ' + token + ' not found on account ' + account.accountAddress.toString());
    return 0;
  }

  return record.amount;
}
