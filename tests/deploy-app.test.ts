import algosdk from 'algosdk'
import nacl from 'tweetnacl'
import { createIdentityApp, setKey, setupIdentityApp } from '../operations/deploy-app'
import { optInContract } from '../utils/opt-in'
import { getAppGlobalState } from '../utils/state'
import { getAlgodClient } from './setup'
import { getTemporaryAccount } from './utils/account'
import { isContractLogicEvalException } from './utils/error'
import config from 'config'
import { getTestEnclaveKeys } from './utils/test-data'

describe('Deploy identity application', () => {
  const enclaveKeys = getTestEnclaveKeys()
  const KYC_CHECK_HASH = config.get('KYC_CHECK_HASH')
  const checkHash = Uint8Array.from(Buffer.from(KYC_CHECK_HASH, 'hex'))
  const globalState = {
    enclave_key: enclaveKeys.publicKey,
    check_hash: checkHash,
  }
  let client, creator, appID, appAddress

  beforeAll(async () => {
    client = getAlgodClient()
    creator = await getTemporaryAccount(client)
  }, 20000)

  it('Creates the smart contract and sets the key', async () => {
    const { appId: createdAppId } = await createIdentityApp(client, creator, enclaveKeys.publicKey)
    appID = createdAppId
    appAddress = await algosdk.getApplicationAddress(appID)

    const actualState = await getAppGlobalState(client, appID)

    expect(actualState).toStrictEqual(globalState)
  })

  it('Contract cannot be setup by non creator account', async () => {
    expect.assertions(1)
    const otherAccount = await getTemporaryAccount(client)
    await optInContract(client, otherAccount, appID)
    try {
      await setupIdentityApp(client, otherAccount, appID)
    } catch (e) {
      expect(isContractLogicEvalException(e)).toBe(true)
    }
  })

  it('Contract setup works', async () => {
    await setupIdentityApp(client, creator, appID)

    const appInfo = await client.accountInformation(appAddress).do()
    const appTokens = appInfo['created-assets']
    expect(appTokens.length).toBe(1)
    expect(appTokens[0].params.name).toBe('SILENTDATA-ID')
    expect(appTokens[0].params['unit-name']).toBe('SDID')
    expect(appTokens[0].params.decimals).toBe(0)
    expect(appTokens[0].params.total).toBe(10000000000)
    expect(appTokens[0].params.clawback).toBe(appAddress)
    expect(appTokens[0].params.freeze).toBe(appAddress)
    expect(appTokens[0].params.manager).toBe(appAddress)
    expect(appTokens[0].params.creator).toBe(appAddress)
    expect(appTokens[0].params.reserve).toBe(appAddress)

    const expectedGlobalState = {
      id_asset_id: appTokens[0].index,
      ...globalState,
    }
    const actualState = await getAppGlobalState(client, appID)
    expect(actualState).toStrictEqual(expectedGlobalState)
  })

  it('Contract cannot be set up twice', async () => {
    expect.assertions(1)
    try {
      await setupIdentityApp(client, creator, appID)
    } catch (e) {
      expect(isContractLogicEvalException(e)).toBe(true)
    }
  })

  it('Enclave key can be set after creation', async () => {
    const seed = new Uint8Array(Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex'))
    const newKeys = nacl.sign.keyPair.fromSeed(seed)
    await setKey(client, creator, appID, newKeys.publicKey)
    const actualState = await getAppGlobalState(client, appID)
    expect(actualState.enclave_key).toEqual(newKeys.publicKey)
  })

  it('Enclave key cannot be set by another user', async () => {
    expect.assertions(1)
    const notCreator = await getTemporaryAccount(client)
    const seed = new Uint8Array(Buffer.from('0000000000000000000000000000000000000000000000000000000000000011', 'hex'))
    const newKeys = nacl.sign.keyPair.fromSeed(seed)
    try {
      await setKey(client, notCreator, appID, newKeys.publicKey)
    } catch (e) {
      expect(isContractLogicEvalException(e)).toBe(true)
    }
  })
})
