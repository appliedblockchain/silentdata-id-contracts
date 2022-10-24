import type AlgodClient from 'algosdk/dist/types/src/client/v2/algod/algod'
import type KMDClient from 'algosdk/dist/types/src/client/kmd'
import algosdk, { Account } from 'algosdk'

const ALGOD_SERVER = process.env.ALGOD_SERVER || 'http://localhost'
const ALGOD_PORT = process.env.ALGOD_PORT || '4001'
const ALGOD_TOKEN = process.env.ALGOD_TOKEN || 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

export function getAlgodClient(): AlgodClient {
  return new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT)
}

const KMD_SERVER = process.env.KMD_SERVER || 'http://localhost'
const KMD_PORT = process.env.KMD_PORT || '4002'
const KMD_TOKEN = process.env.KMD_TOKEN || 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

export function getKmdClient(): KMDClient {
  return new algosdk.Kmd(KMD_TOKEN, KMD_SERVER, KMD_PORT)
}

const kmdAccounts = []

export async function getGenesisAccounts(): Promise<Account[]> {
  if (kmdAccounts.length === 0) {
    const kmd = getKmdClient()

    const { wallets } = await kmd.listWallets()
    if (wallets.length === 0) {
      throw new Error('No wallets')
    }
    const walletID = wallets[0].id

    const { wallet_handle_token: walletHandle } = await kmd.initWalletHandle(walletID, '')

    try {
      const { addresses } = await kmd.listKeys(walletHandle)
      for (let i = 0; i < addresses.length; i++) {
        const privateKey = await kmd.exportKey(walletHandle, '', addresses[i])
        kmdAccounts.push({ sk: privateKey.private_key, addr: addresses[i] })
      }
    } finally {
      await kmd.releaseWalletHandle(walletHandle)
    }
  }

  return kmdAccounts
}
