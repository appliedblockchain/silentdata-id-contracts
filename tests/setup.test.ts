import algosdk from 'algosdk'
import { getAlgodClient, getKmdClient, getGenesisAccounts } from './setup'

describe('setup', () => {
  describe('getAlgodClient', () => {
    it('Should create client', async () => {
      const client = getAlgodClient()
      const response = await client.healthCheck().do()
      expect(response).toStrictEqual({})
    })
  })

  describe('getKmdClient', () => {
    it('Should create KMD client', async () => {
      const client = getKmdClient()
      const { versions } = await client.versions()
      expect(versions).toEqual(['v1'])
    })
  })

  describe('getGenesisAccounts', () => {
    it('Should create valid genesis accounts', async () => {
      const accounts = await getGenesisAccounts()
      expect(accounts.length).toEqual(3)
      accounts.forEach((account) => {
        expect(algosdk.isValidAddress(account.addr)).toBeTruthy()
        expect(account.sk.byteLength).toEqual(64)
      })
    })
  })
})
