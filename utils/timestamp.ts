import AlgodClient from 'algosdk/dist/types/src/client/v2/algod/algod'

export async function getLastBlockTimestamp(
  client: AlgodClient,
): Promise<{ block: Record<string, any>; timestamp: number }> {
  const status = await client.status().do()
  const lastRound = status['last-round']
  const block = await client.block(lastRound).do()
  const timestamp = block['block']['ts']

  return { block, timestamp }
}
