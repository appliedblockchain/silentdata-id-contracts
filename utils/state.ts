import AlgodClient from 'algosdk/dist/types/src/client/v2/algod/algod'

export function getValueFromKeyValue(kv: Record<string, any>, decode = true): number | string | Buffer {
  return {
    [1]: decode ? Buffer.from(kv.value.bytes, 'base64').toString() : Buffer.from(kv.value.bytes, 'base64'),
    [2]: kv.value.uint,
  }[kv.value.type]
}

export function decodeState(stateArray: Record<string, any>): Record<string, any> {
  const state = {}

  for (let i = 0; i < stateArray.length; i++) {
    const key = Buffer.from(stateArray[i]['key'], 'base64').toString('utf8')

    let value = stateArray[i]['value']
    const valueType = value['type']

    if (valueType === 2) {
      // value is uint64
      value = value.uint
    } else if (valueType === 1) {
      // value is byte array
      value = new Uint8Array(Buffer.from(value.bytes, 'base64'))
    } else {
      throw Error(`Unexpected state type: ${valueType}`)
    }

    state[key] = value
  }

  return state
}

export async function getAppGlobalState(client: AlgodClient, appID: number): Promise<Record<string, any>> {
  const appInfo = await client.getApplicationByID(appID).do()
  return decodeState(appInfo['params']['global-state'])
}

export async function getLocalStateValue(
  client: AlgodClient,
  address: string,
  appId: number,
  key: string,
  decode = true,
): Promise<number | string | Buffer> {
  const accountInfo = await client.accountInformation(address).do()
  const localState = accountInfo[`apps-local-state`]
  if (!localState) {
    throw new Error('No local state')
  }
  const appLocalState = localState.find((app) => app.id === appId)
  if (!appLocalState) {
    throw new Error('No local state')
  }
  const keyValuePairs = appLocalState['key-value']
  for (let i = 0; i < keyValuePairs.length; i++) {
    let localKey = keyValuePairs[i].key
    if (decode) {
      localKey = Buffer.from(keyValuePairs[i].key, 'base64').toString()
    }
    if (key === localKey) {
      return getValueFromKeyValue(keyValuePairs[i], decode)
    }
  }
  throw new Error('Key not found')
}
