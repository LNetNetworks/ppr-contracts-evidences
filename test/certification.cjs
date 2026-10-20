const { expect } = require("chai");
const { ethers } = require("ethers");
const { LacchainProvider, LacchainSigner } = require("@lacchain/gas-model-provider");
const hre = require("hardhat");
const { network } = hre;

// Network with gas model (testnet): it has nodeAddress configured
const withGas = Boolean(network.config.nodeAddress);

function getGasSigner(privateKey) {
  const expiration = new Date().getTime() + (5 * 60 * 1000);
  return new LacchainSigner(
    privateKey, new LacchainProvider(network.config.url), network.config.nodeAddress, expiration);
}

async function getSigners() {
  if (withGas) {
    return network.config.accounts.slice(0, 2).map(getGasSigner);
  }
  const [admin, user] = await hre.ethers.getSigners();
  return [admin, user];
}

function randomBytes32() {
  return ethers.hexlify(ethers.randomBytes(32));
}

describe("Certification", function () {
  let certification;
  let entity;
  let otherEntity;

  before(async () => {
    [entity, otherEntity] = await getSigners();

    const artifact = await hre.artifacts.readArtifact(network.config.certificationPath);
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, entity);
    const contract = withGas
      ? await factory.deploy(network.config.trustedForwarderAddress)
      : await factory.deploy();
    const receipt = await contract.deploymentTransaction().wait();

    certification = new ethers.Contract(receipt.contractAddress, artifact.abi, entity);
  });

  async function addDoc(signer, hash, uid) {
    const tx = await certification.connect(signer).addDoc(hash, uid);
    return tx.wait();
  }

  it("should register a document and emit AddDoc", async () => {
    const hash = randomBytes32();
    const uid = randomBytes32();

    const receipt = await addDoc(entity, hash, uid);
    expect(receipt.status).to.equal(1);

    const events = receipt.logs
      .map(log => certification.interface.parseLog(log))
      .filter(event => event && event.name === "AddDoc");
    expect(events).to.have.lengthOf(1);
    expect(events[0].args.hash).to.equal(hash);
    expect(events[0].args.uid).to.equal(uid);
  });

  it("should store the document in the public mappings", async () => {
    const hash = randomBytes32();
    const uid = randomBytes32();
    await addDoc(entity, hash, uid);

    expect(await certification.byhash(hash)).to.equal(uid);
    expect(await certification.byuid(uid)).to.equal(hash);
    expect(await certification.byentity(entity.address, uid)).to.equal(hash);
  });

  it("should verify a registered uid", async () => {
    const uid = randomBytes32();
    await addDoc(entity, randomBytes32(), uid);

    expect(await certification.veryfyByUid(uid)).to.equal(true);
  });

  it("should not verify an unknown uid", async () => {
    expect(await certification.veryfyByUid(randomBytes32())).to.equal(false);
  });

  it("should return the uid of a document by its hash", async () => {
    const hash = randomBytes32();
    const uid = randomBytes32();
    await addDoc(entity, hash, uid);

    expect(await certification.getDocUidByHash(hash)).to.equal(uid);
  });

  it("should return zero for an unknown document hash", async () => {
    expect(await certification.getDocUidByHash(randomBytes32())).to.equal(ethers.ZeroHash);
  });

  it("should list the evidences of each entity separately", async () => {
    const before = await certification.getAllByEntity(entity.address);
    const otherBefore = await certification.getAllByEntity(otherEntity.address);

    const docs = [
      { hash: randomBytes32(), uid: randomBytes32() },
      { hash: randomBytes32(), uid: randomBytes32() },
    ];
    for (const doc of docs) {
      await addDoc(entity, doc.hash, doc.uid);
    }
    const otherDoc = { hash: randomBytes32(), uid: randomBytes32() };
    await addDoc(otherEntity, otherDoc.hash, otherDoc.uid);

    const evidences = await certification.getAllByEntity(entity.address);
    expect(evidences).to.have.lengthOf(before.length + docs.length);
    docs.forEach((doc, i) => {
      expect(evidences[before.length + i].uid).to.equal(doc.uid);
      expect(evidences[before.length + i].hash).to.equal(doc.hash);
    });

    const otherEvidences = await certification.getAllByEntity(otherEntity.address);
    expect(otherEvidences).to.have.lengthOf(otherBefore.length + 1);
    expect(otherEvidences[otherBefore.length].uid).to.equal(otherDoc.uid);
    expect(otherEvidences[otherBefore.length].hash).to.equal(otherDoc.hash);
    expect(await certification.byentity(entity.address, otherDoc.uid)).to.equal(ethers.ZeroHash);
  });
});
