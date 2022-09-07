// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EIP712Signed is Ownable {
    using ECDSA for bytes32;

    error SignedNotEnabled();
    address private signingKey = address(0);
    bytes32 private DOMAIN_SEPARATOR;
    bytes32 private constant MINTER_TYPEHASH = keccak256("Minter(address wallet)");

    constructor() {
        // This should match whats in the client side whitelist signing code
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("EIP712SignedData")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function setSigningAddress(address newSigningKey)
        external
        onlyOwner
    {
        signingKey = newSigningKey;
    }

    function isEIP712Signed(bytes calldata signature)
        public
        view
        returns (bool)
    {
        if(signingKey == address(0)) revert SignedNotEnabled();
        return getEIP712Recover(signature) == signingKey;
    }

    function getEIP712Recover(bytes calldata signature)
        internal
        view
        returns (address)
    {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(MINTER_TYPEHASH, msg.sender))
            )
        );

        return digest.recover(signature);
    }
}