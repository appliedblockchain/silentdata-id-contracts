import AlgodClient from 'algosdk/dist/types/src/client/v2/algod/algod'
import path from 'path'
import fs from 'fs'
import algosdk from 'algosdk'

export type CompiledApp = {
  program: Uint8Array
  programHash: Uint8Array
}

export async function fullyCompileContractFromFile(client: AlgodClient, fileName: string): Promise<CompiledApp> {
  try {
    const filePath = path.join(__dirname, '..', 'teal', fileName)
    const data = fs.readFileSync(filePath)
    const response = await client.compile(data).do()
    return {
      program: new Uint8Array(Buffer.from(response.result, 'base64')),
      // ATTN response.hash is a SHA512_256 of program bytes encoded in the address style
      programHash: algosdk.decodeAddress(response.hash).publicKey,
    }
  } catch (error) {
    console.log(error)
  }
}
