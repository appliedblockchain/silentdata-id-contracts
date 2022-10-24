import AlgodClient from 'algosdk/dist/types/src/client/v2/algod/algod'

export async function getBalances(client: AlgodClient, account: string): Promise<Record<number, number>> {
  let balances

  const accountInfo = await client.accountInformation(account).do()

  // set key 0 to Algo balance
  balances[0] = accountInfo['amount']

  const assets = accountInfo['assets']
  for (let i = 0; i < assets.length; i++) {
    const assetID = assets[i]['asset-id']
    const amount = assets[i]['amount']
    balances[assetID] = amount
  }

  return balances
}
