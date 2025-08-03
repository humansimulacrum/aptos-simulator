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

export async function getAllTokenBalances(account: Account, client: Aptos): Promise<Record<string, number>> {
  const resources = await client.getCurrentFungibleAssetBalances({
    options: { where: { owner_address: { _eq: account.accountAddress.toString() } } },
  });

  if (!resources || resources.length === 0) {
    console.warn('There are no tokens on account ' + account.accountAddress.toString());
    return {};
  }

  const balances: Record<string, number> = {};
  resources.forEach((resource: any) => {
    balances[resource.asset_type] = resource.amount;
  });

  return balances;
}
