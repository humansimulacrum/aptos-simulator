## Functionality:

- Swap with Liquidswap
- Buy/Sell/Relist of the cheap NFTs on Bluemove
- Stake / Unstake on Tortuga and DittoFi
- Everything is randomized, only needed APT on the wallet.

## Installation:

1. Install Node.js => [https://nodejs.org/en/download](https://nodejs.org/en/download)
2. Create Aptos Wallets and fund them (0.4 APT or more is preferred, but not more than 10$ in Aptos, it breaks gas calculations and causes error). Creation could be done with [https://cointool.app/createWallet/aptos](https://cointool.app/createWallet/aptos)
3. Put your private keys in the `privates.txt` file in the root of the folder
4. Run `npm install` to install dependencies
5. Change config (optional) in src/config.const.ts file.
   **txAmountMin** - minimum desired number of transactions per wallet per session

    **txAmountMax** - maximum desired number of transactions per wallet per session
    For example, if you specified txAmountMin = 2 and txAmountMax = 4, then a random number of transactions from 2 to 4 will be performed on each wallet

    **sleepBetweenTransactionsMin** - minimum delay between each transaction in seconds
    **sleepBetweenTransactionsMax** - maximum delay between each transaction in seconds
    For example, if you specified timeSleepMin = 120 and timeSleepMax = 300, then on each the delay between each transaction will be randomly selected in the range from 2 to 5 minutes

    **rpcUrl** - here you can change the node to which transactions will be sent. The list of nodes can be found at [https://cointool.app/rpcServer/aptos](https://cointool.app/rpcServer/aptos)

    **sellCollectionNamesBlacklist** - do not sell valuable nft from this list
5. Run `npm run start`


## Console fields:

**index -** serial number of your wallet from .txt file

**session_duration_min -** Session duration for each wallet in minutes

**progress -** how many transactions have been made out of the total for a particular wallet

**current_tx_type -** current transaction type (NFT action / DEX trading / liquid staking action)

**last_tx_result -** the result of the last transaction

It can be of three types:

1. TX was successful - everything is ok
2. Error when creating a TX - this happens if, for example, an action with nft fell out, but the collection for purchase was not found
3. TX failed - this happens extremely rarely, for example, when someone bought the selected NFT during the formation and sending of the transaction

**min_until_next_tx -** Shows how many minutes to wait until the next transaction on the wallet

**status -** if 0 then the wallet has not yet completed the session, if 1 then completed


### Reach me out, tg: @humansimulacrum if help is needed!