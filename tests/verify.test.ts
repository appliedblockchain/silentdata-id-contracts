import algosdk from 'algosdk'
import { createIdentityApp, getContracts, setupIdentityApp } from '../operations/deploy-app'
import { verifyIdentity } from '../operations/verify'
import { optInContract, optInAsset } from '../utils/opt-in'
import { getAlgodClient } from './setup'
import { getTemporaryAccount } from './utils/account'
import { isContractLogicEvalException } from './utils/error'
import { createIdentityCertificate, getCertificateDataSignature, getTestEnclaveKeys } from './utils/test-data'
import { getLocalStateValue } from '../utils/state'

describe('Verify identity', () => {
  const enclaveKeys = getTestEnclaveKeys()
  const expectedTimestamp = Math.floor(Date.now() / 1000)

  let client, creator, appID, appAddress, assetID, subject, programHash
  beforeAll(async () => {
    client = getAlgodClient()
    creator = await getTemporaryAccount(client)

    const { appId: createdAppId } = await createIdentityApp(client, creator, enclaveKeys.publicKey)
    appID = createdAppId
    appAddress = await algosdk.getApplicationAddress(appID)
    const { programHash: progHash } = await getContracts(client)
    programHash = progHash

    await setupIdentityApp(client, creator, appID)
    const appInfo = await client.accountInformation(appAddress).do()
    const appTokens = appInfo['created-assets']
    assetID = appTokens[0].index

    subject = await getTemporaryAccount(client)
    await optInContract(client, subject, appID)
    await optInAsset(client, subject, assetID)
  }, 20000)

  it('Fails to verify an invalid signature', async () => {
    expect.assertions(2)
    const encodedCertificate = await createIdentityCertificate(subject)
    const signature = await getCertificateDataSignature(programHash, encodedCertificate, enclaveKeys)
    expect(signature.length).toBeGreaterThan(1)
    signature[0] = signature[0] === 0 ? 1 : 0

    try {
      await verifyIdentity(client, appID, subject, encodedCertificate, signature)
    } catch (e) {
      expect(isContractLogicEvalException(e)).toBe(true)
    }
  })

  it('Fails to verify invalid signed data', async () => {
    expect.assertions(2)
    const encodedCertificate = await createIdentityCertificate(subject)
    const signature = await getCertificateDataSignature(programHash, encodedCertificate, enclaveKeys)
    expect(encodedCertificate.length).toBeGreaterThan(1)
    encodedCertificate[0] = encodedCertificate[0] === 0 ? 1 : 0

    try {
      await verifyIdentity(client, appID, subject, encodedCertificate, signature)
    } catch (e) {
      expect(isContractLogicEvalException(e)).toBe(true)
    }
  })

  it('Fails to verify if sender has not opted in', async () => {
    expect.assertions(1)
    const subject2 = await getTemporaryAccount(client)
    await optInContract(client, subject2, appID)
    const encodedCertificate = await createIdentityCertificate(subject2)
    const signature = await getCertificateDataSignature(programHash, encodedCertificate, enclaveKeys)
    try {
      await verifyIdentity(client, appID, subject2, encodedCertificate, signature)
    } catch (e) {
      expect(isContractLogicEvalException(e)).toBe(true)
    }
  })

  it('Fails to verify if proof type does not match global state', async () => {
    expect.assertions(1)
    const encodedCertificate = await createIdentityCertificate(subject, {
      check_hash: new Uint8Array(32),
    })
    const signature = await getCertificateDataSignature(programHash, encodedCertificate, enclaveKeys)
    try {
      await verifyIdentity(client, appID, subject, encodedCertificate, signature)
    } catch (e) {
      expect(isContractLogicEvalException(e)).toBe(true)
    }
  })

  it('Fails to verify if sender is not proof owner', async () => {
    expect.assertions(1)
    const subject2 = await getTemporaryAccount(client)
    const encodedCertificate = await createIdentityCertificate(subject2)
    const signature = await getCertificateDataSignature(programHash, encodedCertificate, enclaveKeys)
    try {
      await verifyIdentity(client, appID, subject, encodedCertificate, signature)
    } catch (e) {
      expect(isContractLogicEvalException(e)).toBe(true)
    }
  })

  it('Verifies an identity certificate and receives token', async () => {
    const encodedCertificate = await createIdentityCertificate(subject, {
      check_timestamp: expectedTimestamp,
    })
    const signature = await getCertificateDataSignature(programHash, encodedCertificate, enclaveKeys)
    await verifyIdentity(client, appID, subject, encodedCertificate, signature)
    const info = await client.accountInformation(subject.addr).do()
    expect(info.assets.length).toBe(1)
    expect(info.assets[0]['asset-id']).toBe(assetID)
    expect(info.assets[0].amount).toBe(1)
    expect(info.assets[0]['is-frozen']).toBe(true)
    const checkTimestamp = await getLocalStateValue(client, subject.addr, appID, 'check_timestamp')
    expect(checkTimestamp).toBe(expectedTimestamp)
  })

  it('Cannot verify identity twice with same timestamp', async () => {
    expect.assertions(1)
    const encodedCertificate = await createIdentityCertificate(subject, {
      check_timestamp: expectedTimestamp,
    })
    const signature = await getCertificateDataSignature(programHash, encodedCertificate, enclaveKeys)
    try {
      await verifyIdentity(client, appID, subject, encodedCertificate, signature)
    } catch (e) {
      expect(isContractLogicEvalException(e)).toBe(true)
    }
  })

  it('Cannot verify identity again with older check', async () => {
    expect.assertions(1)
    const encodedCertificate = await createIdentityCertificate(subject, {
      check_timestamp: expectedTimestamp - 10,
    })
    const signature = await getCertificateDataSignature(programHash, encodedCertificate, enclaveKeys)
    try {
      await verifyIdentity(client, appID, subject, encodedCertificate, signature)
    } catch (e) {
      expect(isContractLogicEvalException(e)).toBe(true)
    }
  })

  it('Can verify identity again with newer check', async () => {
    const encodedCertificate = await createIdentityCertificate(subject, {
      check_timestamp: expectedTimestamp + 10,
    })
    const signature = await getCertificateDataSignature(programHash, encodedCertificate, enclaveKeys)
    await verifyIdentity(client, appID, subject, encodedCertificate, signature)
    const checkTimestamp = await getLocalStateValue(client, subject.addr, appID, 'check_timestamp')
    expect(checkTimestamp).toBe(expectedTimestamp + 10)
  })
})
