# PPR Contracts — Evidences (Certification)

Smart contract **Certification** for the **PPR project**: an on-chain registry of document evidences. Each evidence links a document hash to a unique identifier (`uid`), both as `bytes32`, and is stored per registering account (entity).

- **`addDoc(hash, uid)`**: registers an evidence. Stores `hash → uid` and `uid → hash`, appends it to the caller's list and emits `AddDoc(hash, uid)`.
- **`veryfyByUid(uid)`**: returns `true` if a document is registered for that `uid`.
- **`getDocUidByHash(hash)`**: returns the `uid` registered for a document hash, or `bytes32(0)` if none.
- **`getAllByEntity(entity)`**: returns every `Evidence { uid, hash }` registered by an address.
- Public mappings `byhash`, `byuid` and `byentity(entity, uid)` can also be queried directly.

## Repository layout

| Path | Description |
| --- | --- |
| `contracts_Without_Gas/certification.sol` | Certification for networks **without a gas model** (Hardhat network, `localhost`, LACNet zkSync). The entity is `msg.sender`. |
| `contracts_With_Gas/certification.sol` | Certification for networks **with a gas model** (LACChain / LNet). Inherits from `BaseRelayRecipient`, takes a `trustedForwarder` and uses `_msgSender()` as the entity. |
| `contracts_With_Gas/BaseRelayRecipient.sol` | Meta-transaction base contract used by the gas-model variant. |
| `deploy/deploy-lnet.js` | Deploys Certification on a local node or the gas-model network and calls `addDoc`, `getDocUidByHash` and `getAllByEntity`. |
| `deploy/deployContract.js` | Deploys Certification on the LACNet zkSync testnet, authenticating against Keycloak. |
| `test/certification.cjs` | Certification tests (see [Test](#test)). |
| `hardhat.config.default` | Hardhat configuration template, including custom `compile` and `test` tasks. Rename it to `hardhat.config.js` (see [Configuration](#configuration)). |

### Constructor arguments

| Variant | Arguments |
| --- | --- |
| Without gas | none |
| With gas | `trustedForwarder_` |

## Prerequisites

- Node.js 20.19 or later
- npm

```shell
npm install
```

## Configuration

### 1. Create `hardhat.config.js`

The repository ships the configuration as a template. Rename `hardhat.config.default` to `hardhat.config.js`:

```shell
mv hardhat.config.default hardhat.config.js
```

Every `npx hardhat` command (compile, test, node) needs this file.

### 2. Complete the `testnet` values

The `hardhat` and `localhost` networks are already configured and need no changes. To work with the gas-model network, fill in `testnet`:

```js
testnet: {
  url: "",                      // RPC URL of the gas-model node
  nodeAddress: "",              // Address of the node that relays the transactions
  expiration: 2836394529,       // Expiration timestamp used by the gas model
  accounts: [],                 // Private keys (32 bytes, hex), e.g. ["0x...", "0x..."]
  trustedForwarderAddress: "",  // TrustedForwarder contract address on the network
  certificationPath: "",        // Set automatically by the custom test task
},
```

> ⚠️ **Hardhat validates `accounts` on every command**, including `compile` and local runs. Empty strings such as `[""]` fail with `HH8: private key too short`. If you only work locally, leave `accounts: []`.

> ⚠️ **Never commit real private keys or credentials.** Keep `hardhat.config.js` and the completed deploy scripts out of version control, or load the values from environment variables.

## Compile

The custom `compile` task compiles **both** contract folders and writes the artifacts to `artifacts/`:

```shell
npx hardhat compile
```

Generated artifacts (used by the deploy scripts):

- `artifacts/contracts_Without_Gas/certification.sol/Certification.json`
- `artifacts/contracts_With_Gas/certification.sol/Certification.json`

## Test

The custom `test` task picks the contract folder from the selected network, compiles it and runs the tests.

| Network | Contract folder | Command |
| --- | --- | --- |
| Hardhat (in-process) | `contracts_Without_Gas` | `npx hardhat test` |
| Local node | `contracts_Without_Gas` | `npx hardhat test --network localhost` (with `npx hardhat node` running) |
| Testnet (LACChain / LNet) | `contracts_With_Gas` | `npx hardhat test --network testnet` |

The Hardhat and local runs need no extra configuration. The testnet run uses the `testnet` values in `hardhat.config.js`: `url`, `nodeAddress`, `trustedForwarderAddress` and **two** private keys in `accounts` (the second one is used as another entity).

## Deploy

| Script | Network | Contract variant | Signer | How it is configured |
| --- | --- | --- | --- | --- |
| `deploy/deploy-lnet.js` | `localhost` or gas-model network | `contracts_Without_Gas` / `contracts_With_Gas` | `Wallet` or `LacchainSigner` | `localConfig` / `gasConfig` objects in the script |
| `deploy/deployContract.js` | LACNet zkSync testnet | `contracts_Without_Gas` | `Wallet` + Keycloak bearer token | `zksyncConfig` object in the script |

The deploy scripts read the compiled artifacts but **not** `hardhat.config.js`: their network values are set in the script itself. Before deploying, install the dependencies, create `hardhat.config.js` and compile (see the sections above).

### Local network or network with gas (`deploy-lnet.js`)

The script deploys Certification (or reuses `CONTRACT_ADDRESS`), registers an evidence with `addDoc` and reads it back with `getDocUidByHash` and `getAllByEntity`. The first argument selects the configuration: `local` (default) uses `localConfig`, a plain `Wallet` and the **without gas** artifact; `gas` uses `gasConfig`, `LacchainSigner` and the **with gas** artifact.

**`localConfig`** (network without gas, ready to use):

| Variable | Default | Description |
| --- | --- | --- |
| `network_rpc` | `http://127.0.0.1:8545` | RPC URL of the local node. |
| `address_private_key` | Hardhat test account #19 | Private key of the deployer / caller. |

**`gasConfig`** (network with gas, all required):

| Variable | Equivalent in `hardhat.config.js` | Description |
| --- | --- | --- |
| `gas_network_rpc` | `testnet.url` | RPC URL of the LACChain / LNet writer node. |
| `gas_node_address` | `testnet.nodeAddress` | Address of the node that relays the transactions. |
| `gas_trusted_forwarder` | `testnet.trustedForwarderAddress` | TrustedForwarder address, passed as `trustedForwarder_`. |
| `gas_address_private_key` | `testnet.accounts[0]` | Private key of the deployer. |

The transaction expiration is computed automatically: now + 5 minutes.

**Interaction values** in the script:

| Variable | Default | Description |
| --- | --- | --- |
| `CONTRACT_ADDRESS` | `""` | Address of an already deployed Certification. Empty = deploy a new one. |
| `uid_hash` | `"ui-9999"` | Evidence `uid`, hashed with `keccak256`. |
| `doc_hash` | `"file-name-9999"` | Document hash, hashed with `keccak256`. |

**Step by step**

1. Choose the network:
   - **Local**: start a node in a separate terminal:

     ```shell
     npx hardhat node
     ```

   - **With gas**: fill in `gasConfig` in `deploy/deploy-lnet.js`.

2. Run the script:

   ```shell
   # Local node
   node deploy/deploy-lnet.js

   # Network with gas
   node deploy/deploy-lnet.js gas
   ```

3. The script prints the contract address, the `addDoc` transaction and the stored evidence:

   ```text
   Contract Address:  0x5FbDB2315678afecb367f032d93F642f64180aa3
   2-hash-document- 0x…
   3-UID, DOC---- 0x…
   ```

4. To work with the same contract later, set its address in `CONTRACT_ADDRESS`.

### LACNet zkSync testnet (`deployContract.js`)

The script obtains a JWT from Keycloak (`password` grant), adds it as `Authorization: Bearer …` to every RPC request and deploys the without-gas Certification.

**`zksyncConfig`** (all required):

| Variable | Description |
| --- | --- |
| `provider_rpc_url` | RPC URL of the LACNet zkSync testnet. |
| `user_private_key` | Private key of the deployer (hex, without `0x`). |
| `keycloak_token_url` | Keycloak token endpoint (`…/realms/<realm>/protocol/openid-connect/token`). |
| `client_id`, `client_secret` | Keycloak client credentials. |
| `username`, `password` | Keycloak user credentials. |

**Step by step**

1. Fill in `zksyncConfig` in `deploy/deployContract.js`.
2. Deploy:

   ```shell
   node deploy/deployContract.js
   ```

3. The script prints the origin address and the contract address (`🎉 Deployed! At: 0x…`).

## Using the contract

Evidences are registered with `addDoc(hash, uid)`, both as `bytes32`. Plain strings must be hashed first, for example:

```js
const uid  = ethers.keccak256(ethers.toUtf8Bytes("usr_001"));
const hash = ethers.keccak256(fileBytes); // hash of the document content
await certification.addDoc(hash, uid);

await certification.veryfyByUid(uid);        // true
await certification.getDocUidByHash(hash);   // uid
await certification.getAllByEntity(signer.address);
```

On the with-gas variant, the entity recorded is the original sender relayed through the TrustedForwarder.

## License

Apache License 2.0. See [LICENSE.md](LICENSE.md).
