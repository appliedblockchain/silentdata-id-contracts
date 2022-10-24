import algosdk, { Account } from 'algosdk'
import AlgodClient from 'algosdk/dist/types/src/client/v2/algod/algod'
import { PendingTxnResponse, waitForTransaction } from '../../utils/transactions'
import { getTemporaryAccount } from './account'
import crypto from 'crypto'

export async function optInToAsset(
  client: AlgodClient,
  assetID: number,
  account: Account,
): Promise<PendingTxnResponse> {
  const suggestedParams = await client.getTransactionParams().do()
  const txn = algosdk.makeApplicationOptInTxnFromObject({
    from: account.addr,
    appIndex: assetID,
    suggestedParams: suggestedParams,
  })
  const signedTxn = txn.signTxn(account.sk)

  const tx = await client.sendRawTransaction(signedTxn).do()
  return waitForTransaction(client, tx.txId)
}

export async function createDummyAsset(client: AlgodClient, total: number, account?: Account): Promise<number> {
  if (!account) {
    account = await getTemporaryAccount(client)
  }

  const randomNumber = Math.floor(Math.random() * 1000)
  // this random note reduces the likelihood of this transaction looking like a duplicate
  const randomNote = crypto.randomBytes(20)

  const suggestedParams = await client.getTransactionParams().do()

  const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    from: account.addr,
    total: total,
    decimals: 0,
    defaultFrozen: false,
    manager: account.addr,
    reserve: account.addr,
    freeze: account.addr,
    clawback: account.addr,
    unitName: `${randomNumber}`,
    assetName: `Dummy ${randomNumber}`,
    assetURL: `https://dummy.asset/${randomNumber}`,
    note: randomNote,
    suggestedParams: suggestedParams,
  })
  const signedTxn = txn.signTxn(account.sk)

  const tx = await client.sendRawTransaction(signedTxn).do()

  const response = await waitForTransaction(client, tx.txId)
  if (!response.assetIndex || response.assetIndex === 0) {
    throw Error('Error creating asset')
  }
  return response.assetIndex
}
