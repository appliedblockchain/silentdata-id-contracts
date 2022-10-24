import algosdk, { Account } from 'algosdk'
import cbor from 'cbor'
import config from 'config'
import nacl from 'tweetnacl'

export function getTestEnclaveKeys(): nacl.SignKeyPair {
  // Generate a ed25519 key-pair for the enclave keys
  // Seed is arbirary (not using random seed for reproduciblity)
  const seed = new Uint8Array(Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'))
  return nacl.sign.keyPair.fromSeed(seed)
}

interface IdentityParams {
  check_hash: ArrayBuffer
  proof_id: string
  timestamp: number
  check_timestamp: number
  subject_id: ArrayBuffer
  initiator_pkey: ArrayBuffer
}

export async function createIdentityCertificate(
  subject: Account,
  customIdentityParams?: Partial<IdentityParams>,
): Promise<Uint8Array> {
  const KYC_CHECK_HASH = config.get('KYC_CHECK_HASH')
  const checkHash = Uint8Array.from(Buffer.from(KYC_CHECK_HASH, 'hex'))
  const identityCertificate = {
    check_hash: checkHash.buffer,
    id: '123e4567-e89b-12d3-a456-426614174000',
    timestamp: Math.floor(Date.now() / 1000) - 60 * 60 * 24,
    check_timestamp: Math.floor(Date.now() / 1000) - 60 * 60 * 24,
    subject_id: new Uint8Array(32).buffer,
    initiator_pkey: algosdk.decodeAddress(subject.addr).publicKey.buffer,
    ...customIdentityParams,
  }

  return new Uint8Array(cbor.encode(identityCertificate))
}

export function getCertificateDataSignature(
  programHash: Uint8Array,
  certificateDataCBOR: Uint8Array,
  enclaveKeys: nacl.SignKeyPair,
): Uint8Array {
  const toSign = Buffer.concat([Buffer.from('ProgData'), Buffer.from(programHash), Buffer.from(certificateDataCBOR)])
  return new Uint8Array(nacl.sign.detached(toSign, enclaveKeys.secretKey))
}
