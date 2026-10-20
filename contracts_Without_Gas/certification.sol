// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

contract Certification {
    struct Evidence {
        bytes32 uid;
        bytes32 hash;
    }
   
   mapping(bytes32 => bytes32) public byhash;
   mapping(bytes32 => bytes32) public byuid;
   mapping(address => mapping(bytes32 => bytes32)) public byentity;
   mapping(address => Evidence[]) private evidencesByEntity;
   event AddDoc(bytes32 hash, bytes32 uid);

  function addDoc(bytes32 hash, bytes32 uid) public {
    byhash[hash] = uid;
    byuid[uid] = hash;
    byentity[msg.sender][uid] = hash;
    evidencesByEntity[msg.sender].push(Evidence(uid, hash));
    emit AddDoc(hash, uid);
  }

  function veryfyByUid(bytes32 uid) public view returns (bool) {
    return byuid[uid] != 0;
  }
  
  function getDocUidByHash(bytes32 hash) public view returns (bytes32) {
    if (byhash[hash] != 0){
      return byhash[hash];
    } else {
      return bytes32(0) ;
    }
  }

  /*
  function getAllByEntity(address entity) public view returns (Evidence[] memory) {
    uint count = 0;
    // First loop to count how many documents the entity has
    for (uint i = 0; i < 2**256 - 1; i++) {
      bytes32 uid = byentity[entity][bytes32(i)];
      if (uid != 0) {
        count++;
      } else {
        break;
      }
    }

    Evidence[] memory evidences = new Evidence[](count);
    uint index = 0;
    // Second loop to populate the evidences array
    for (uint i = 0; i < 2**256 - 1; i++) {
      bytes32 uid = byentity[entity][bytes32(i)];
      if (uid != 0) {
        evidences[index] = Evidence(uid, byuid[uid]);
        index++;
      } else {
        break;
      }
    }

    return evidences;
  }*/

  function getAllByEntity(address entity) public view returns (Evidence[] memory) {
        return evidencesByEntity[entity];
  }

}