import { AptosAccount, AptosClient, HexString } from 'aptos';

import { LiquidStakeModule } from './modules/stake.module';
import { NftModule } from './modules/nft.module';
import { SwapModule } from './modules/swap.module';

import {
  manualTxTypeChoice,
  rpcUrl,
  sleepBetweenTransactionsMax,
  sleepBetweenTransactionsMin,
  txAmountMax,
  txAmountMin,
} from './config.const';

import { tokenList } from './tokenList.const';
import { renderOutput } from './helpers/console.helper';
import { importWallets } from './helpers/file-import.helper';
import { getRandomInt, sleep } from './helpers';

const client = new AptosClient(rpcUrl);

let walletOutputDataArr: WalletOutputData[] = [];

async function main() {
  const privateKeys = await importWallets();

  for (let i = 0; i < privateKeys.length; i++) {
    try {
      const aptosAccount = new AptosAccount(new HexString(privateKeys[i]).toUint8Array());
      await client.getAccountResources(aptosAccount.address());
    } catch (error) {
      console.log('Wrong private keys are entered or there are no funds on the wallet: ');
      console.log(i + ') ' + privateKeys[i]);
      return;
    }
  }

  for (let i = 0; i < privateKeys.length; i++) {
    walletOutputDataArr.push({
      session_duration_min: 0,
      progress: '0/0',
      current_tx_type: '',
      last_tx_result: '',
      min_until_next_tx: 0,
      status: 0,
    });

    session(
      getRandomInt(txAmountMin, txAmountMax),
      privateKeys[i],
      i,
      sleepBetweenTransactionsMin * 1000,
      sleepBetweenTransactionsMax * 1000
    );
  }

  renderOutput(walletOutputDataArr);
}

main();

async function session(
  txAmount: number,
  privateKey: string,
  walletID: number,
  timeSleepMin: number,
  timeSleepMax: number
) {
  const dexTrader = new SwapModule(privateKey, client);
  const liquidStaker = new LiquidStakeModule(privateKey, client);
  const nftTrader = new NftModule(privateKey, client);

  const msDelayArr: number[] = [];
  let totalDelay = 0;
  for (let i = 0; i < txAmount; i++) {
    let randomSleep = getRandomInt(timeSleepMin, timeSleepMax);
    if (i === 0) {
      randomSleep = randomSleep * walletID;
    }
    msDelayArr.push(randomSleep);
    totalDelay += randomSleep;
  }

  walletOutputDataArr[walletID].session_duration_min = Number((totalDelay / 60000).toFixed(2));
  walletOutputDataArr[walletID].progress = '0/' + txAmount;

  for (let i = 0; i < txAmount; i++) {
    await sleep(msDelayArr[i]);
    walletOutputDataArr[walletID].min_until_next_tx = Number((msDelayArr[i] / 60000).toFixed(2));

    const txType: number = manualTxTypeChoice || getRandomInt(1, 3);
    let txHash;
    switch (txType) {
      case 1:
        walletOutputDataArr[walletID].current_tx_type = 'DEX trading';
        txHash = await dexTrader.makeRandomSwap();
        break;

      case 2:
        walletOutputDataArr[walletID].current_tx_type = 'NFT action';
        txHash = await nftTrader.makeRandomNftAction(tokenList[0].estimatedPriceInUsd);
        break;

      case 3:
        walletOutputDataArr[walletID].current_tx_type = 'liquid staking action';
        txHash = await liquidStaker.makeRandomStakeAction();
        break;

      default:
        break;
    }

    if (txHash === 'error') {
      walletOutputDataArr[walletID].last_tx_result = 'Error when creating a TX';
    } else {
      const txResult = ((await client.waitForTransactionWithResult(txHash as string)) as any).success;
      if (txResult) {
        walletOutputDataArr[walletID].last_tx_result = 'TX was successful';
      } else {
        walletOutputDataArr[walletID].last_tx_result = 'TX failed';
      }
    }
    walletOutputDataArr[walletID].progress = i + 1 + '/' + txAmount;
  }
  walletOutputDataArr[walletID].status = 1;
}

declare type WalletOutputData = {
  session_duration_min: number;
  progress: string;
  current_tx_type: string;
  last_tx_result: string;
  min_until_next_tx: number;
  status: number;
};
