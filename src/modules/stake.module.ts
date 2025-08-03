import { Aptos, Account, Ed25519PrivateKey, MoveFunctionId } from '@aptos-labs/ts-sdk';
import { tokenList } from '../tokenList.const';
import { calculatePercentage, getRandomInt, getAllTokenBalances } from '../helpers';

const TORTUGA_CONTRACT_ADDRESS = '0x8f396e4246b2ba87b51c0739ef5ea4f26515a98375308c31ac2ec1e42142a57f';
const APTOS_TORTUGA_STAKED_ADDRESS = '0xbd35135844473187163ca197ca93b2ab014370587bb0ed3befff9e902d6bb541';
const STAKED_APTOS_COIN_ADDRESS = '0x84d7aeef42d38a5ffc3ccef853e1b82e4958659d16a7de736a29c55fbbeb0114';
const DITTO_STAKED_APTOS_ADDRESS = '0xd11107bdf0d6d7040c6c0bfbdecb6545191fdf13e8d8d259952f53e1713f61b5';

export class LiquidStakeModule {
  private privateKey: string;
  private account: Account;
  private client: Aptos;

  constructor(privateKey: string, client: Aptos) {
    this.privateKey = privateKey;
    const privateKeyInstance = new Ed25519PrivateKey(this.privateKey);
    this.account = Account.fromPrivateKey({ privateKey: privateKeyInstance });
    this.client = client;
  }

  public async makeRandomStakeAction(): Promise<string> {
    try {
      const balances = await getAllTokenBalances(this.account, this.client);
      const stAPTbalance = balances[tokenList[4].address] || 0;
      const tAPTbalance = balances[tokenList[5].address] || 0;

      let txHash;

      if (stAPTbalance + tAPTbalance > 0) {
        const action = getRandomInt(0, 1);
        if (action) txHash = await this.randomUnStake(stAPTbalance, tAPTbalance, balances);
        else txHash = await this.randomStake(balances);
      } else {
        txHash = await this.randomStake(balances);
      }

      return txHash;
    } catch (error: any) {
      console.log(`${this.account.accountAddress}: Error occured - ${error.message}`);
      return 'error';
    }
  }

  private async randomUnStake(
    stAPTbalance: number,
    tAPTbalance: number,
    balances: Record<string, number>
  ): Promise<string> {
    const amountForDitto = getRandomInt(calculatePercentage(stAPTbalance, 60), calculatePercentage(stAPTbalance, 100));
    const amountForTortuga = getRandomInt(calculatePercentage(tAPTbalance, 60), calculatePercentage(tAPTbalance, 100));

    let txHash;

    if (stAPTbalance > 0 && tAPTbalance > 0) {
      const action = getRandomInt(0, 1);
      if (action) txHash = await this.unstakeFromDittoFi(amountForDitto, balances);
      else txHash = await this.unstakeFromTortuga(amountForTortuga, balances);
    } else {
      if (stAPTbalance > 0) {
        txHash = await this.unstakeFromDittoFi(amountForDitto, balances);
      } else {
        txHash = await this.unstakeFromTortuga(amountForTortuga, balances);
      }
    }

    return txHash;
  }

  private async randomStake(balances: Record<string, number>): Promise<string> {
    const APTbalance = balances[tokenList[0].address] || 0;
    const amount = getRandomInt(calculatePercentage(APTbalance, 20), calculatePercentage(APTbalance, 60));

    const platformNum = getRandomInt(1, 2);
    let sendedTxHash;

    if (platformNum === 1) sendedTxHash = await this.stakeOnDittoFi(amount);
    else sendedTxHash = await this.stakeOnTortuga(amount);

    return sendedTxHash as string;
  }

  public async stakeOnDittoFi(amount: number): Promise<string> {
    // build transaction
    const rawTxn = await this.client.transaction.build.simple({
      sender: this.account.accountAddress,
      data: {
        function: `${DITTO_STAKED_APTOS_ADDRESS}::ditto_staking::stake_aptos`,
        typeArguments: [],
        functionArguments: [amount.toString()],
      },
    });

    // sign transaction
    const senderAuthenticator = this.client.transaction.sign({
      signer: this.account,
      transaction: rawTxn,
    });

    // submit transaction
    const pendingTransaction = await this.client.transaction.submit.simple({
      transaction: rawTxn,
      senderAuthenticator,
    });

    return pendingTransaction.hash;
  }

  public async unstakeFromDittoFi(amount: number, balances: Record<string, number>): Promise<string> {
    const stAPTbalance = balances[tokenList[4].address] || 0;
    if (amount > stAPTbalance) amount = stAPTbalance;

    // build transaction
    const rawTxn = await this.client.transaction.build.simple({
      sender: this.account.accountAddress,
      data: {
        function: `${DITTO_STAKED_APTOS_ADDRESS}::ditto_staking::instant_unstake`,
        typeArguments: [],
        functionArguments: [amount.toString()],
      },
    });

    // sign transaction
    const senderAuthenticator = this.client.transaction.sign({
      signer: this.account,
      transaction: rawTxn,
    });

    // submit transaction
    const pendingTransaction = await this.client.transaction.submit.simple({
      transaction: rawTxn,
      senderAuthenticator,
    });

    return pendingTransaction.hash;
  }

  public async stakeOnTortuga(amount: number): Promise<string> {
    // build transaction
    const rawTxn = await this.client.transaction.build.simple({
      sender: this.account.accountAddress,
      data: {
        function: `${TORTUGA_CONTRACT_ADDRESS}::stake_router::stake` as MoveFunctionId,
        typeArguments: [],
        functionArguments: [amount.toString()],
      },
    });

    // sign transaction
    const senderAuthenticator = this.client.transaction.sign({
      signer: this.account,
      transaction: rawTxn,
    });

    // submit transaction
    const pendingTransaction = await this.client.transaction.submit.simple({
      transaction: rawTxn,
      senderAuthenticator,
    });

    return pendingTransaction.hash;
  }

  public async unstakeFromTortuga(amount: number, balances: Record<string, number>): Promise<string> {
    const tAPTbalance = balances[tokenList[5].address] || 0;
    if (amount > tAPTbalance) amount = tAPTbalance;

    // build transaction
    const rawTxn = await this.client.transaction.build.simple({
      sender: this.account.accountAddress,
      data: {
        function: `${APTOS_TORTUGA_STAKED_ADDRESS}::amm::swap_exact_coin_for_coin_with_signer` as MoveFunctionId,
        typeArguments: [
          `${STAKED_APTOS_COIN_ADDRESS}::staked_aptos_coin::StakedAptosCoin`,
          '0x1::aptos_coin::AptosCoin',
        ],
        functionArguments: [amount.toString(), '0'],
      },
    });

    // sign transaction
    const senderAuthenticator = this.client.transaction.sign({
      signer: this.account,
      transaction: rawTxn,
    });

    // submit transaction
    const pendingTransaction = await this.client.transaction.submit.simple({
      transaction: rawTxn,
      senderAuthenticator,
    });

    return pendingTransaction.hash;
  }
}
