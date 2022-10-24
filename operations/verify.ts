import algosdk, { Account, SuggestedParams } from 'algosdk'
import { waitForTransaction } from '../utils/transactions'
import AlgodClient from 'algosdk/dist/types/src/client/v2/algod/algod'
import { randomBytes } from 'crypto'
import config from 'config'

function createFundTxn(sender: Account, appID: number, suggestedParams: SuggestedParams): algosdk.Transaction {
  return algosdk.makeApplicationNoOpTxnFromObject({
    from: sender.addr,
    appIndex: appID,
    appArgs: [new Uint8Array(Buffer.from('fund'))],
    suggestedParams: suggestedParams,
    note: new Uint8Array(randomBytes(32)),
  })
}

export async function verifyIdentity(
  client: AlgodClient,
  appID: number,
  sender: Account,
  data: Uint8Array,
  signature: Uint8Array,
): Promise<void> {
  const suggestedParams = await client.getTransactionParams().do()
  suggestedParams.flatFee = true
  suggestedParams.fee = config.get('VERIFY_FEE')

  const appAddress = await algosdk.getApplicationAddress(appID)
  const appInfo = await client.accountInformation(appAddress).do()
  const appTokens = appInfo['created-assets']
  if (appTokens.length !== 1) {
    throw new Error('Invalid number of application tokens')
  }

  const verifyTxn = algosdk.makeApplicationNoOpTxnFromObject({
    from: sender.addr,
    appIndex: appID,
    appArgs: [new Uint8Array(Buffer.from('verify')), data, signature],
    foreignAssets: [appTokens[0].index],
    suggestedParams: suggestedParams,
  })

  const nFundTxns = 5
  const fundTxns = []
  for (let i = 0; i < nFundTxns; i++) {
    fundTxns.push(createFundTxn(sender, appID, suggestedParams))
  }

  algosdk.assignGroupID([verifyTxn, ...fundTxns])

  const signedVerifyTxn = verifyTxn.signTxn(sender.sk)
  const signedFundTxns = []
  for (const fundTxn of fundTxns) {
    signedFundTxns.push(fundTxn.signTxn(sender.sk))
  }

  const tx = await client.sendRawTransaction([signedVerifyTxn, ...signedFundTxns]).do()

  await waitForTransaction(client, tx.txId)
}
