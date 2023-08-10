import { AptosAccount, AptosClient, HexString, Network, Provider } from 'aptos';
import { tokenList } from '../tokenList.const';
import {
  addHoursAndGetSeconds,
  calculatePercentage,
  getRandomInt,
  getTokenBalance,
  sendGetRequest,
  shuffle,
} from '../helpers';

const blueMoveExchangeAddress = `0xd1fd99c1944b84d1670a2536417e997864ad12303d19eac725891691b04d614e`;

export class NftModule {
  private privateKey: string;
  private client: AptosClient;
  private hexPrivateKey: HexString;
  private aptosAccount: AptosAccount;

  constructor(privateKey: string, client: AptosClient) {
    this.privateKey = privateKey;
    this.hexPrivateKey = new HexString(this.privateKey);
    this.aptosAccount = new AptosAccount(this.hexPrivateKey.toUint8Array());
    this.client = client;
  }
  public async makeRandomNftAction(APTprice: number): Promise<string> {
    const APTbalance = await getTokenBalance(tokenList[0].address, this.aptosAccount, this.client);

    const accountNfts = await this.getAccountNFTs();
    const listedItems = await this.getListedItems();

    if (accountNfts.length === 0) {
      // 0 NFT is in the wallet

      if (listedItems.length === 0) {
        // 0 listed => buy
        // 2$ - max nft price, 30% max percentage for nft
        return this.handleBuyAction(APTbalance, APTprice, 2, 30);
      }

      if (listedItems.length <= 2) {
        // 1-2 listed => relist / buy
        const action = getRandomInt(0, 1);
        if (action) {
          // 0.7$ - max nft price, 15% max percentage for NFT
          return this.handleBuyAction(APTbalance, APTprice, 0.7, 15);
        } else {
          return this.handleRelistAction(listedItems);
        }
      }

      // if listed is more than 2 - relist action is what we do
      return this.handleRelistAction(listedItems);
    }

    if (accountNfts.length >= 1 && accountNfts.length <= 2) {
      // 1-2 NFT is in the wallet

      if (listedItems.length === 0) {
        // 0 listed => buy / list
        const action = getRandomInt(0, 1);
        if (action) {
          return this.handleBuyAction(APTbalance, APTprice, 0.6, 12);
        } else {
          return this.handleListAction(accountNfts);
        }
      }

      if (listedItems.length <= 2) {
        // 1-2 listed => list / relist
        return this.handleListOrRelistAction(accountNfts, listedItems);
      }

      // >2 listed => list / relist
      return this.handleListOrRelistAction(accountNfts, listedItems);
    }

    // more than 2 NFTs in the wallet
    if (listedItems.length === 0) {
      // only list
      return this.handleListAction(accountNfts);
    }

    if (listedItems.length <= 2) {
      // 1-2 listed => list/relist
      return this.handleListOrRelistAction(accountNfts, listedItems);
    }

    // more than 2 listed => list/relist
    return this.handleListOrRelistAction(accountNfts, listedItems);
  }

  private async handleBuyAction(balance: number, price: number, usdValue: number, percentage: number): Promise<string> {
    let txHash: string;

    if (Number(balance) > 150000000) {
      // buying with fixed max usd value
      txHash = await this.blueMoveBuy(Math.floor((usdValue / price) * 100000000));
    } else {
      // buying with max usd value in the percents of total APT value
      txHash = await this.blueMoveBuy(calculatePercentage(balance, percentage));
    }

    return txHash;
  }

  private async handleRelistAction(listedItems: any[]): Promise<string> {
    const nftForRelist = listedItems[getRandomInt(0, listedItems.length - 1)];

    const delistTxHash = await this.blueMoveDelistFromSale(nftForRelist);
    const delistResult = await this.handleTransactionResult(delistTxHash);

    if (delistResult === `error`) {
      return `error`;
    }

    const relistTxHash = await this.blueMoveListForSell(nftForRelist);
    return this.handleTransactionResult(relistTxHash);
  }

  private async handleListAction(accountNfts: any[]): Promise<string> {
    const nftForList = accountNfts[getRandomInt(0, accountNfts.length - 1)];
    return this.blueMoveListForSell(nftForList);
  }

  private async handleListOrRelistAction(accountNfts: any[], listedItems: any[]): Promise<string> {
    const action = getRandomInt(0, 1);
    if (action) {
      return this.handleListAction(accountNfts);
    } else {
      return this.handleRelistAction(listedItems);
    }
  }

  private async handleTransactionResult(txHash: string): Promise<string> {
    const result = ((await this.client.waitForTransactionWithResult(txHash)) as any).success;
    if (result) {
      return txHash;
    } else {
      return `error`;
    }
  }

  private async getListedItems(): Promise<NftItem[]> {
    const response = await sendGetRequest(
      `https://aptos-mainnet-api.bluemove.net/api/market-items?filters%5Blisted_address%5D%5B%24eq%5D=` +
        this.aptosAccount.address().toString() +
        `&filters%5Bstatus%5D%5B%24eq%5D=1&populate%5Bcollection%5D%5Bfields%5D%5B0%5D=name&populate%5Bcollection%5D%5Bfields%5D%5B1%5D=creator&pagination%5Bpage%5D=1&pagination%5BpageSize%5D=10000`
    );

    let listedItems: NftItem[] = [];
    if (response.data.length === 0) return listedItems;

    for (let i = 0; i < response.data.length; i++) {
      const { name, collection_name, creator, property_version, price } = response.data[i].attributes;

      const NftItem = {
        name,
        collection_name,
        creator,
        property_version,
        price,
      };

      listedItems.push(NftItem);
    }

    return listedItems;
  }

  public async blueMoveBuy(maxPrice: number): Promise<string> {
    // looking for the collection to buy
    const collectionForBuy = await this.searchOptimalCollectionForBuy(maxPrice);
    if (collectionForBuy === 0) {
      // didn`t found one
      return `error`;
    }

    const nftForBuy = await this.getCheapestItemFromCollection(collectionForBuy);
    if (nftForBuy === undefined) {
      return `error`;
    }
    const payload = await this.getPayloadForNftBuy(nftForBuy);

    const max_gas_amount = await this.client.estimateMaxGasAmount(this.aptosAccount.address());
    const options: Partial<SubmitTransactionRequest> = {
      max_gas_amount: max_gas_amount.toString(),
      expiration_timestamp_secs: addHoursAndGetSeconds(1).toString(),
    };
    const rawTx = await this.client.generateTransaction(this.aptosAccount.address(), payload, options);

    return await this.client.signAndSubmitTransaction(this.aptosAccount, rawTx);
  }

  public async getAccountNFTs(): Promise<NftItem[]> {
    const provider = new Provider(`mainnet` as Network);
    const allNfts = await provider.getAccountNFTs(this.aptosAccount.address());
    let blueMoveAccountNfts: any[] = [];

    const bluemoveCollections = await this.getCollections();

    for (let i = 0; i < allNfts.current_token_ownerships.length; i++) {
      const userNftCollectionName = allNfts.current_token_ownerships[i].current_collection_data?.collection_name;
      let result = false;

      for (let j = 0; j < bluemoveCollections.length; j++) {
        if (bluemoveCollections[j].attributes.name === userNftCollectionName) {
          result = true;
          break;
        }
      }
      if (result) {
        const NftItem: NftItem = {
          name: allNfts.current_token_ownerships[i].current_token_data?.name as string,
          collection_name: allNfts.current_token_ownerships[i].current_token_data?.collection_name as string,
          creator: allNfts.current_token_ownerships[i].current_token_data?.creator_address as string,
          property_version: allNfts.current_token_ownerships[i].property_version,
          price: ``,
        };
        blueMoveAccountNfts.push(NftItem);
      }
    }
    return blueMoveAccountNfts;
  }

  public async blueMoveListForSell(item: NftItem): Promise<string> {
    const payload = await this.getPayloadForNftSell(item);
    if (payload === 0) return `error`;

    const max_gas_amount = await this.client.estimateMaxGasAmount(this.aptosAccount.address());
    const options: Partial<SubmitTransactionRequest> = {
      max_gas_amount: max_gas_amount.toString(),
      expiration_timestamp_secs: addHoursAndGetSeconds(1).toString(),
    };
    const rawTx = await this.client.generateTransaction(
      this.aptosAccount.address(),
      payload as EntryFunctionPayload,
      options
    );

    return this.client.signAndSubmitTransaction(this.aptosAccount, rawTx);
  }

  public async blueMoveDelistFromSale(item: NftItem): Promise<string> {
    const payload = await this.getPayloadForNftDelist(item);

    const max_gas_amount = await this.client.estimateMaxGasAmount(this.aptosAccount.address());
    const options: Partial<SubmitTransactionRequest> = {
      max_gas_amount: max_gas_amount.toString(),
      expiration_timestamp_secs: addHoursAndGetSeconds(1).toString(),
    };
    const rawTx = await this.client.generateTransaction(
      this.aptosAccount.address(),
      payload as EntryFunctionPayload,
      options
    );

    return await this.client.signAndSubmitTransaction(this.aptosAccount, rawTx);
  }

  private async getSellPriceByCollectionName(collectionName: string): Promise<string> {
    const collections = await this.getCollections();
    for (let i = 0; i < collections.length; i++) {
      if (collections[i].attributes.name === collectionName) {
        const cheapestItem = await this.getCheapestItemFromCollection(collections[i]);
        if (cheapestItem === undefined) return `10000000`;
        return cheapestItem.price;
      }
    }
    return `0`;
  }

  private async getPayloadForNftDelist(item: NftItem): Promise<EntryFunctionPayload> {
    const moveFunction = `${blueMoveExchangeAddress}::marketplaceV2::batch_delist_script`;
    const _arguments = [[item.creator], [item.collection_name], [item.name], [item.property_version]];

    return { function: moveFunction, type_arguments: [], arguments: _arguments };
  }

  private async getPayloadForNftSell(item: NftItem): Promise<EntryFunctionPayload | number> {
    const moveFunction = `${blueMoveExchangeAddress}::marketplaceV2::batch_list_script`;
    const sellPrice = await this.getSellPriceByCollectionName(item.collection_name);
    if (sellPrice === `0`) return 0;
    const _arguments = [
      [item.creator],
      [item.collection_name],
      [item.name],
      [Math.floor(calculatePercentage(Number(sellPrice), 95)).toString()],
      [item.property_version],
    ];

    return { function: moveFunction, type_arguments: [], arguments: _arguments };
  }

  private async searchOptimalCollectionForBuy(maxPrice: number): Promise<any> {
    const collections = await this.getCollections();
    for (let i = 0; i < collections.length; i++) {
      if (Number(collections[i].attributes.floor_price) <= maxPrice) {
        const cheapestItem = await this.getCheapestItemFromCollection(collections[i]);
        if (cheapestItem === undefined) continue;
        if (collections[i].attributes.floor_price === cheapestItem.price) return collections[i];
        else {
          if (Number(cheapestItem.price) <= maxPrice) return collections[i];
        }
      }
    }
    return 0;
  }

  private async getCheapestItemFromCollection(collection: any): Promise<NftItem | undefined> {
    const collectionId = collection.id;
    const collectionInfo = await sendGetRequest(
      `https://aptos-mainnet-api.bluemove.net/api/market-items?filters[collection][id][$eq]=` +
        collectionId +
        `&filters[$or][0][status][$eq]=1&filters[price][$gte]=0&filters[price][$lte]=10000000000000000&sort[0]=price%3Aasc&pagination[page]=1&pagination[pageSize]=24`
    );
    const rawCheapestItem = collectionInfo[`data`][0];
    if (rawCheapestItem === undefined) return undefined;
    return {
      name: rawCheapestItem.attributes.name,
      collection_name: rawCheapestItem.attributes.collection_name,
      creator: rawCheapestItem.attributes.creator,
      property_version: rawCheapestItem.attributes.property_version,
      price: rawCheapestItem.attributes.price,
    };
  }

  private async getPayloadForNftBuy(item: NftItem): Promise<EntryFunctionPayload> {
    const moveFunction = `${blueMoveExchangeAddress}::marketplaceV2::batch_buy_script`;
    const _arguments = [[item.creator], [item.collection_name], [item.name], [item.price + item.property_version]];

    return { function: moveFunction, type_arguments: [], arguments: _arguments };
  }

  private async getCollections(): Promise<any[]> {
    const page1 = await sendGetRequest(
      `https://aptos-mainnet-api.bluemove.net/api/collections?filters[name][$containsi]=&sort[0]=createdAt%3ADESC&pagination[page]=1&pagination[pageSize]=100`
    );
    const page2 = await sendGetRequest(
      `https://aptos-mainnet-api.bluemove.net/api/collections?filters[name][$containsi]=&sort[0]=createdAt%3ADESC&pagination[page]=2&pagination[pageSize]=100`
    );
    const page3 = await sendGetRequest(
      `https://aptos-mainnet-api.bluemove.net/api/collections?filters[name][$containsi]=&sort[0]=createdAt%3ADESC&pagination[page]=3&pagination[pageSize]=100`
    );

    let collections: any[] = [];

    for (let i = 0; i < page1[`data`].length; i++) collections.push(page1[`data`][i]);
    for (let i = 0; i < page2[`data`].length; i++) collections.push(page2[`data`][i]);
    for (let i = 0; i < page3[`data`].length; i++) collections.push(page3[`data`][i]);

    return shuffle(collections);
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

declare type NftItem = {
  name: string;
  collection_name: string;
  creator: string;
  property_version: string;
  price: string;
};
