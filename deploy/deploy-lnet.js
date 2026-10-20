const { ethers, JsonRpcProvider, Wallet } = require("ethers");
const { LacchainProvider, LacchainSigner } = require('@lacchain/gas-model-provider');

const contractAbiWithGas = require("../artifacts/contracts_With_Gas/certification.sol/Certification.json");
const contractAbiWithoutGas= require("../artifacts/contracts_Without_Gas/certification.sol/Certification.json");


const gasConfig = {
gas_network_rpc: "",
gas_node_address:"",
gas_trusted_forwarder:"",
gas_address_private_key:""
}

const localConfig = {
network_rpc:"http://127.0.0.1:8545",
address_private_key:"0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e"
}

// Address of an already deployed Certification contract. Empty = deploy a new one
const CONTRACT_ADDRESS = "";

function isGasConfig(config) {
  return Boolean(config.gas_node_address && config.gas_address_private_key);
}

function getSigner(config){
  if (isGasConfig(config)) {
    const expiration = new Date().getTime() + (5 * 60 * 1000);
    return new LacchainSigner(
      config.gas_address_private_key, new LacchainProvider(config.gas_network_rpc), config.gas_node_address, expiration);
  }
  return new Wallet(config.address_private_key, new JsonRpcProvider(config.network_rpc));
}

function getArtifact(config) {
  return isGasConfig(config) ? contractAbiWithGas : contractAbiWithoutGas;
}

async function deploy(config) {
  const signer = getSigner(config);
  const artifact = getArtifact(config);
  const cert_contractFactory = new ethers.ContractFactory( artifact.abi, artifact.bytecode, signer );

  console.log("1-Deploying Certification contract");
  const pcontract = isGasConfig(config)
    ? await cert_contractFactory.deploy(config.gas_trusted_forwarder)
    : await cert_contractFactory.deploy();
  const preceipt = await pcontract.deploymentTransaction()?.wait();
  console.log("Contract deployed!");
  const pcontractAddress = preceipt?.contractAddress;
  console.log(`Contract Address: `, pcontractAddress );
  return pcontractAddress;
}

function ensureBytes32(input) {
  if (typeof input === 'string' && input.startsWith('0x') && input.length === 66) {
    return input; // already bytes32
  }
  return ethers.keccak256(ethers.toUtf8Bytes(input));
}

function getContract(address,config) {
  return new ethers.Contract( address, getArtifact(config).abi, getSigner(config) );
}

async function doMethodAddDoc(address,config){
  const certcontract = getContract(address,config);
  const uid_hash = ensureBytes32("ui-9999");
  const doc_hash = ensureBytes32("file-name-9999");
  const tx = await certcontract.addDoc(doc_hash, uid_hash);
  await tx.wait();
  console.log("2-hash-document-",tx.hash);
  return { txHash:tx.hash,doc_hash,uid_hash };
}

async function doMethodDocUiByHash(address,doc_hash,config){
  const certcontract = getContract(address,config);
  const res = await certcontract.getDocUidByHash(ensureBytes32(doc_hash));
  console.log("3-UID, DOC----",res);
}

async function doMethodGetAllByEntity(address,config){
  const certcontract = getContract(address,config);
  const signer = getSigner(config);
  const data = await certcontract.getAllByEntity(signer.address);
  console.log("4--data doMethodGetAllByEntity---",data);
}

async function main() {
  try {
    // node deploy/deploy-lnet.js [local|gas]
    const config = process.argv[2] === "gas" ? gasConfig : localConfig;
    console.log(`Network: ${isGasConfig(config) ? "gas model" : "local"}`);

    const address = CONTRACT_ADDRESS || await deploy(config);

    const resdoc = await doMethodAddDoc(address,config);
    console.log("RESULT",resdoc);
    await doMethodDocUiByHash(address,resdoc.doc_hash,config);
    await doMethodGetAllByEntity(address,config);

  } catch(error){
   console.error(error);
   process.exitCode = 1;
  }
}

main();
