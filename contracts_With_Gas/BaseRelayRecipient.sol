// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;
abstract contract BaseRelayRecipient {
    address internal trustedForwarder;
    constructor(address trustedForwarder_) {
        trustedForwarder = trustedForwarder_;
    }
    function _msgSender() internal view virtual returns (address sender) {
        bytes memory bytesRelayHub;
        (, bytesRelayHub) = trustedForwarder.staticcall(
            abi.encodeWithSignature("getRelayHub()")
        );
        if (msg.sender == abi.decode(bytesRelayHub, (address))) {
            bytes memory bytesSender;
            (, bytesSender) = trustedForwarder.staticcall(
                abi.encodeWithSignature("getMsgSender()")
            );
            return abi.decode(bytesSender, (address));
        } else {
            return msg.sender;
        }
    }
}