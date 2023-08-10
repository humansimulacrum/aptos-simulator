import { AptosAccount, AptosClient } from 'aptos';

export async function getTokenBalance(token: string, account: AptosAccount, client: AptosClient): Promise<number> {
  token = '0x1::coin::CoinStore<' + token + '>';
  const resources = await client.getAccountResources(account.address());
  for (let i = 0; i < resources.length; i++) {
    if (resources[i]['type'] === token) {
      return (resources[i]['data'] as any)['coin']['value'] as number;
    }
  }
  return 0;
}
