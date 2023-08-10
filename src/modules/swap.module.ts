import { AptosAccount, AptosClient, HexString } from 'aptos';
import { Token, tokenList } from '../tokenList.const';
import { addHoursAndGetSeconds, calculatePercentage, getRandomInt, getTokenBalance } from '../helpers';

const LIQUID_SWAP_CONTRACT_ADDRESS = '0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12';

export class SwapModule {
  private privateKey: string;
  private hexPrivateKey: HexString;
  private account: AptosAccount;
  private walletAddress: HexString;
  private client: AptosClient;

  constructor(privateKey: string, client: AptosClient) {
    this.privateKey = privateKey;
    this.hexPrivateKey = new HexString(this.privateKey);
    this.account = new AptosAccount(this.hexPrivateKey.toUint8Array());
    this.walletAddress = this.account.address();
    this.client = client;
  }

  public async makeRandomSwap(): Promise<string> {
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
      const txResult = ((await this.client.waitForTransactionWithResult(regTokenTx as string)) as any).success;
      if (!txResult) return 'error';
    }

    const sendedTxHash = await this.liquidSwap(fromToken, toToken, amount);
    return sendedTxHash;
  }

  public async registerToken(token: Token): Promise<string> {
    const txPayload = this.getPayloadForRegisterToken(token);
    const max_gas_amount = await this.client.estimateMaxGasAmount(this.account.address());
    const options: Partial<SubmitTransactionRequest> = {
      max_gas_amount: max_gas_amount.toString(),
      expiration_timestamp_secs: addHoursAndGetSeconds(1).toString(),
    };
    const rawTX = await this.client.generateTransaction(this.walletAddress, txPayload, options);
    return await this.client.signAndSubmitTransaction(this.account, rawTX);
  }

  public async liquidSwap(fromToken: Token, toToken: Token, amount: number): Promise<string> {
    const txPayload = this.getPayloadForLiquidSwap(fromToken, toToken, amount);

    const max_gas_amount = await this.client.estimateMaxGasAmount(this.account.address());
    const options: Partial<SubmitTransactionRequest> = {
      max_gas_amount: max_gas_amount.toString(),
      expiration_timestamp_secs: addHoursAndGetSeconds(1).toString(),
    };

    const rawTX = await this.client.generateTransaction(this.walletAddress, txPayload, options);
    return this.client.signAndSubmitTransaction(this.account, rawTX);
  }

  private getPayloadForLiquidSwap(fromToken: Token, toToken: Token, amount: number): EntryFunctionPayload {
    const moveFunction = `${LIQUID_SWAP_CONTRACT_ADDRESS}::scripts_v2::swap`;

    const type_arguments = [
      fromToken.address,
      toToken.address,
      `${LIQUID_SWAP_CONTRACT_ADDRESS}::curves::Uncorrelated`,
    ];
    const _arguments = [amount.toString(), ''];

    return { function: moveFunction, type_arguments: type_arguments, arguments: _arguments };
  }

  private getPayloadForRegisterToken(token: Token): EntryFunctionPayload {
    const moveFunction = '0x1::managed_coin::register';
    const type_arguments = [token.address];
    const _arguments: string[] = [];
    return { function: moveFunction, type_arguments: type_arguments, arguments: _arguments };
  }
}

declare type EntryFunctionPayload = {
  function: string;
  type_arguments: Array<any>;
  arguments: Array<any>;
};

declare type SubmitTransactionRequest = {
  sender: string;
  sequence_number: string;
  max_gas_amount: string;
  gas_unit_price: string;
  expiration_timestamp_secs: string;
  payload: TransactionPayload_EntryFunctionPayload;
  signature: TransactionSignature_Ed25519Signature;
};

declare type TransactionPayload_EntryFunctionPayload = {
  type: string;
} & EntryFunctionPayload;

declare type TransactionSignature_Ed25519Signature = {
  type: string;
} & Ed25519Signature$1;

declare type Ed25519Signature$1 = {
  public_key: string;
  signature: string;
};
