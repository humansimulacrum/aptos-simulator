import {
  Account,
  Aptos,
  Ed25519PrivateKey,
  InputGenerateTransactionPayloadData,
  MoveFunctionId,
} from '@aptos-labs/ts-sdk';
import { Token, tokenList } from '../tokenList.const';
import { calculatePercentage, getRandomInt, getTokenBalance } from '../helpers';

const LIQUID_SWAP_CONTRACT_ADDRESS = '0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12';

export class SwapModule {
  private privateKey: string;
  private account: Account;
  private client: Aptos;

  constructor(privateKey: string, client: Aptos) {
    this.privateKey = privateKey;
    // Derive account from private key using the new SDK
    const privateKeyInstance = new Ed25519PrivateKey(this.privateKey);
    this.account = Account.fromPrivateKey({ privateKey: privateKeyInstance });
    this.client = client;
  }

  public async makeRandomSwap(): Promise<string> {
    try {
      let fromToken;
      let toToken;
      let amount;

      const accountTokens: Token[] = [];

      for (let i = 0; i < tokenList.length; i++) {
        const tokenBalance = await getTokenBalance(tokenList[i].address, this.account, this.client);
        const cashInToken = tokenList[i].estimatedPriceInUsd * (tokenBalance / 10 ** tokenList[i].decimals);
        if (cashInToken > 0.1) accountTokens.push(tokenList[i]);
      }

      fromToken = accountTokens[getRandomInt(0, accountTokens.length - 1)];

      while (true) {
        // if APT is not the only one token available - we should grab another one
        if (accountTokens.length === 1 && accountTokens[0] === tokenList[0]) {
          toToken = tokenList[getRandomInt(1, tokenList.length - 1)];
        } else {
          toToken = tokenList[getRandomInt(0, tokenList.length - 1)];
        }

        // till we found the token that is different
        if (toToken.address !== fromToken.address) break;
      }

      const fromTokenBalance = await getTokenBalance(fromToken.address, this.account, this.client);

      if (fromToken === tokenList[0]) {
        amount = getRandomInt(calculatePercentage(fromTokenBalance, 10), calculatePercentage(fromTokenBalance, 70));
      } else {
        amount = getRandomInt(calculatePercentage(fromTokenBalance, 10), fromTokenBalance);
      }

      if (!accountTokens.includes(toToken)) {
        const regTokenTx = await this.registerToken(toToken);
        const txResult = await this.client.waitForTransaction({ transactionHash: regTokenTx });
        if (!txResult) return 'error';
      }

      const sendedTxHash = await this.swapToken(fromToken, toToken, amount);
      return sendedTxHash;
    } catch (error: any) {
      console.log(`${this.account.accountAddress}: Error occured - ${error.message}`);
      return 'error';
    }
  }

  public async registerToken(token: Token): Promise<string> {
    const payload = this.getPayloadForRegisterToken(token);
    // build transaction
    const rawTxn = await this.client.transaction.build.simple({
      sender: this.account.accountAddress,
      data: {
        function: payload.function as `${string}::${string}::${string}`,
        typeArguments: payload.typeArguments,
        functionArguments: payload.functionArguments,
      },
    });
    const senderAuthenticator = this.client.transaction.sign({
      signer: this.account,
      transaction: rawTxn,
    });
    const transactionRes = await this.client.transaction.submit.simple({
      transaction: rawTxn,
      senderAuthenticator: senderAuthenticator,
    });
    const transaction = await this.client.waitForTransaction({
      transactionHash: transactionRes.hash,
    });
    console.log(`Register transaction confirmed: ${transaction.hash}`);
    return transaction.hash;
  }

  public async swapToken(tokenIn: Token, tokenOut: Token, amountIn: number) {
    try {
      const payload = this.getPayloadForLiquidSwap(tokenIn, tokenOut, amountIn);
      const rawTxn = await this.client.transaction.build.simple({
        sender: this.account.accountAddress,
        data: {
          function: payload.function as `${string}::${string}::${string}`,
          typeArguments: payload.typeArguments,
          functionArguments: payload.functionArguments,
        },
      });

      const senderAuthenticator = this.client.transaction.sign({
        signer: this.account,
        transaction: rawTxn,
      });

      const transactionRes = await this.client.transaction.submit.simple({
        transaction: rawTxn,
        senderAuthenticator: senderAuthenticator,
      });
      const transaction = await this.client.waitForTransaction({
        transactionHash: transactionRes.hash,
      });
      console.log(`Swap transaction confirmed: ${transaction.hash}`);
      return transaction.hash;
    } catch (error) {
      console.error('Swap failed:', error);
      throw error;
    }
  }

  private getPayloadForLiquidSwap(fromToken: Token, toToken: Token, amount: number): EntryFunctionPayload {
    const moveFunction = `${LIQUID_SWAP_CONTRACT_ADDRESS}::scripts_v2::swap` as MoveFunctionId;

    const typeArguments = [fromToken.address, toToken.address, `${LIQUID_SWAP_CONTRACT_ADDRESS}::curves::Uncorrelated`];
    const functionArguments = [amount.toString(), ''];

    return { function: moveFunction, typeArguments, functionArguments };
  }

  private getPayloadForRegisterToken(token: Token): EntryFunctionPayload {
    const moveFunction = '0x1::managed_coin::register' as MoveFunctionId;
    const typeArguments = [token.address];
    const functionArguments: string[] = [];

    return { function: moveFunction, typeArguments, functionArguments };
  }
}

type EntryFunctionPayload = InputGenerateTransactionPayloadData & {
  function: MoveFunctionId;
  typeArguments: any[];
  functionArguments: any[];
};
