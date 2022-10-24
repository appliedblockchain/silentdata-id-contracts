import algosdk, { Account } from 'algosdk'
import AlgodClient from 'algosdk/dist/types/src/client/v2/algod/algod'
import { waitForTransaction, transferAsset } from './transactions'

export async function optInContract(client: AlgodClient, sender: Account, appId: number): Promise<any> {
  const suggestedParams = await client.getTransactionParams().do()
  const txn = await algosdk.makeApplicationOptInTxn(sender.addr, suggestedParams, appId)

  const signedTxn = txn.signTxn(sender.sk)
  const txId = txn.txID().toString()

  const xtx = await client.sendRawTransaction(signedTxn).do()

  await waitForTransaction(client, txId)
  return xtx
}

export async function optInAsset(client: AlgodClient, sender: Account, assetId: number): Promise<any> {
  return await transferAsset(client, sender, sender.addr, assetId, 0)
}
