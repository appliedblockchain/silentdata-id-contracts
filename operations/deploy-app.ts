import algosdk, { Account } from 'algosdk'
import { waitForTransaction } from '../utils/transactions'
import { fullyCompileContractFromFile } from '../utils/compile-contract'
import AlgodClient from 'algosdk/dist/types/src/client/v2/algod/algod'
import config from 'config'

export interface CompiledContracts {
  approval: Uint8Array
  clearState: Uint8Array
  programHash: Uint8Array
}

export async function getContracts(client: AlgodClient): Promise<CompiledContracts> {
  const { program: approval, programHash } = await fullyCompileContractFromFile(client, 'identity-approval.teal')
  const { program: clearState } = await fullyCompileContractFromFile(client, 'identity-clear.teal')

  return { approval, clearState, programHash }
}

export type CreateAppResult = {
  appId: number
  programHash: Uint8Array
}

export async function createIdentityApp(
  client: AlgodClient,
  sender: Account,
  enclavePublicKey: Uint8Array,
): Promise<CreateAppResult> {
  const { approval, clearState, programHash } = await getContracts(client)

  const { GLOBAL_BYTE_SLICES, GLOBAL_INTS, LOCAL_BYTE_SLICES, LOCAL_INTS } = config.get('ID_APP_STATE')
  const KYC_CHECK_HASH = config.get('KYC_CHECK_HASH')
  const checkHash = Uint8Array.from(Buffer.from(KYC_CHECK_HASH, 'hex'))
  const suggestedParams = await client.getTransactionParams().do()
  const txn = algosdk.makeApplicationCreateTxnFromObject({
    from: sender.addr,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram: approval,
    clearProgram: clearState,
    numGlobalByteSlices: GLOBAL_BYTE_SLICES,
    numGlobalInts: GLOBAL_INTS,
    numLocalByteSlices: LOCAL_BYTE_SLICES,
    numLocalInts: LOCAL_INTS,
    appArgs: [enclavePublicKey, checkHash],
    suggestedParams: suggestedParams,
  })

  const signedTxn = txn.signTxn(sender.sk)

  const tx = await client.sendRawTransaction(signedTxn).do()

  const response = await waitForTransaction(client, tx.txId)
  if (!response.applicationIndex || response.applicationIndex === 0) {
    throw Error('Invalid response')
  }

  return {
    appId: response.applicationIndex,
    programHash,
  }
}

export async function setupIdentityApp(client: AlgodClient, sender: Account, appId: number): Promise<number> {
  const suggestedParams = await client.getTransactionParams().do()

  const appAddress = await algosdk.getApplicationAddress(appId)

  const fundAppTxn = await algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: sender.addr,
    to: appAddress,
    amount: config.get('ID_APP_MINIMUM_BALANCE') + config.get('MINIMUM_TRANSACTION_FEE'),
    suggestedParams: suggestedParams,
  })

  const setupTxn = await algosdk.makeApplicationNoOpTxnFromObject({
    from: sender.addr,
    suggestedParams: suggestedParams,
    appIndex: appId,
    appArgs: [new Uint8Array(Buffer.from('setup'))],
  })

  algosdk.assignGroupID([fundAppTxn, setupTxn])
  const signedFundAppTxn = fundAppTxn.signTxn(sender.sk)
  const signedSetupTxn = setupTxn.signTxn(sender.sk)

  const tx = await client.sendRawTransaction([signedFundAppTxn, signedSetupTxn]).do()

  await waitForTransaction(client, tx.txId)

  return appId
}

export async function setKey(
  client: AlgodClient,
  sender: Account,
  appId: number,
  enclavePublicKey: Uint8Array,
): Promise<number> {
  const suggestedParams = await client.getTransactionParams().do()

  const txn = await algosdk.makeApplicationNoOpTxnFromObject({
    from: sender.addr,
    suggestedParams: suggestedParams,
    appIndex: appId,
    appArgs: [new Uint8Array(Buffer.from('set_key')), enclavePublicKey],
  })

  const signedTxn = txn.signTxn(sender.sk)

  const tx = await client.sendRawTransaction(signedTxn).do()

  await waitForTransaction(client, tx.txId)

  return appId
}
