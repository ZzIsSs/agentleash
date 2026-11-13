// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC1271, IFiatToken} from "../../src/AgentPolicy.sol";

/// @title MockUSDC
/// @notice Minimal mock of Circle's FiatTokenV2_2 implementing EIP-3009 and ERC-1271 verification.
contract MockUSDC is IFiatToken {
    string public constant name = "USD Coin";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;

    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    bytes32 internal immutable _DOMAIN_SEPARATOR;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(bytes32 => bool)) internal _authorizationStates;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);

    constructor() {
        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes("2")),
                block.chainid,
                address(this)
            )
        );
    }

    function DOMAIN_SEPARATOR() external view override returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function authorizationState(address authorizer, bytes32 nonce) external view override returns (bool) {
        return _authorizationStates[authorizer][nonce];
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 value) external override returns (bool) {
        require(balanceOf[msg.sender] >= value, "ERC20: insufficient balance");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external override {
        require(block.timestamp > validAfter, "FiatTokenV2: auth not yet valid");
        require(block.timestamp < validBefore, "FiatTokenV2: auth expired");
        require(!_authorizationStates[from][nonce], "FiatTokenV2: auth already used");
        require(balanceOf[from] >= value, "FiatTokenV2: insufficient balance");

        bytes32 structHash = keccak256(
            abi.encode(
                TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                _DOMAIN_SEPARATOR,
                structHash
            )
        );

        if (from.code.length > 0) {
            bytes4 magic = IERC1271(from).isValidSignature(digest, signature);
            require(magic == 0x1626ba7e, "FiatTokenV2: invalid signature");
        } else {
            // For EOA tests if needed
            revert("MockUSDC: EOA not supported in mock");
        }

        _authorizationStates[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);

        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}
