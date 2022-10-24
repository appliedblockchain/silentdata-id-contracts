# Silent Data ID Smart Contract

**Note:** This code has not been security auditied and should only be used as an example.

[Silent Data](https://silentdata.com) is a platform for proving properties of private web2 data in the form of signed proof certificates that can be consumed by smart contracts. Silent Data leverages Intel SGX enclaves in order to enable privacy-preserving retrieval and processing of off-chain data, and generation of cryptographic proofs that are verifiable in blockchain smart contracts. This ensures that sensitive information is never revealed, not even to those hosting the platform, and that the code used to retrieve the data and generate the proofs cannot be modified or interfered with by the operator.

Silent Data ID is composed of a single stateful smart contract deployed on the Algorand blockchain. The accepted enclave signing public key and proof type are stored in the global storage of the contract at creation. Any user is able to read the public key and verify that it comes from a legitimate enclave. The contract maintains a reserve of unminted, fungible identity tokens that can only be distributed and transferred by the contract.

After successfully completing the KYC proof process on Silent Data, the subject of the check will have access to the signed proof certificate. The subject can upload the proof data and signature contained in the certificate to the contract in a transaction signed by their wallet private key. The contract will verify the signature using the global public key and then parse the CBOR encoded data to extract the wallet address, proof type and the time of the check.

The wallet address is compared with the sender of the transaction and the proof type is compared with the allowed value in global storage. If all of the verifications are successful the contract will transfer an identity token to the wallet of the subject. The token will be frozen so that the subject is not able to transfer the token to another wallet. The contract will also write the timestamp of the check into the local storage of the user so that other applications can access that information if they require the checks to have been completed within a certain time period. Other DeFi applications can now be convinced that the holders of these identity tokens have undergone KYC checks.

![SILENTDATA whitepaper](https://user-images.githubusercontent.com/12896404/197566689-51a1d4f9-569e-46cf-a7e7-3e0ec3a96fbe.png)

## Setup

``` bash
npm i
```

## Tests

``` bash
./sandbox up dev
npm run test
./sandbox down
```

If you see `ERROR: No container found for algod_1`, it might be an issue with a previous sandbox container still hanging around somewhere. Try to find `sandbox_algod` with `docker container ls -a` and remove it with `docker container rm < container id >`.

## Deployment

Use this command to test your configuration before deploying the contract:

``` bash
npm run deploy:dry
```

Below are the environment variables that you can/need to set:

- Algod server configuration. Optional - by default the credentials for the sandbox will be used.
  - `ALGOD_SERVER` = the algod server host
  - `ALGOD_PORT` = the algod server port
  - `ALGOD_TOKEN` = the algod server token

- Application creator account. Either set `CREATOR_MNEMONIC` or `GENERATE_CREATOR_ACCOUNT=true`.
  - `CREATOR_MNEMONIC` = the mnemonic for the account that should create the application (needs to have algos)
  - `GENERATE_CREATOR_ACCOUNT` = If running in the sandbox, can set this to `true` to generate a temporary account for the creator - useful for testing.

- Enclave configuration. Required.
  - `ENCLAVE_PUBLIC_KEY` = the public signing key used by the enclave to sign certificates (hex encoded)

Once you have a valid configuration, a file will be created in the [scripts/logs/](scripts/logs) directory with the suffix `_dry-run.json`.
Read this file to double check that you are happy with your configuration options.

Once happy, deploy for real using:

``` bash
npm run deploy
```

The details of the newly created application will be output in the logs directory, including it's ID & program hash.

## Deployment to TestNet

### Create a new account on TestNet if you need to

Use this command to generate a new account:

``` bash
npm run generate-account
```

This will create a new randomly generated account & write the details to [scripts/logs/](scripts/logs) with the file prefix `account_`.

Go to the Algorand TestNet dispenser and get some Algos for testing by entering your newly generated address (see `addr` in the output file):
[https://bank.testnet.algorand.network/](https://bank.testnet.algorand.network/)

You can check that this worked by going to [https://testnet.algoexplorer.io/](https://testnet.algoexplorer.io/) and looking the account's address.

### Run the deployment script

- Set `ALGOD_SERVER`, `ALGOD_PORT` and `ALGOD_TOKEN` to point to the Applied Blockchain Algorand TestNet node (ask someone for the details if you don't know them already).
- Set `CREATOR_MNEMONIC` to the mnemonic of the account (if you generated it in the last step see `mn` in the output file)
- Set `GENERATE_CREATOR_ACCOUNT` to `false`
- Set `ENCLAVE_PUBLIC_KEY` to the required value (should be the `sigModulus` returned by the enclave)
- Run `npm run deploy:dry`
- Check the configuration, and once you're happy run: `npm run deploy`
- The newly created `appId` & `programHash` are printed to the log file

### Update the enclave key

The development contracts allow the admin to set the enclave key after the initial deployment.

Use this command to set a new key:

``` bash
npm run set-key
```

- Set `ALGOD_SERVER`, `ALGOD_PORT` and `ALGOD_TOKEN` to point to the Applied Blockchain Algorand TestNet node.
- Set `CREATOR_MNEMONIC` to the mnemonic of the account used to deploy the app.
- Set `ENCLAVE_PUBLIC_KEY` to the required value (should be the `sigModulus` returned by the enclave).
- Set `SILENTDATA_ID_APP_ID` to the app ID of the deployed app.
- Can use `npm run set-key -- --dry-run` to test first.
