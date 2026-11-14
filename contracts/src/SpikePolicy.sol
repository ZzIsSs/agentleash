// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC1271 {
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4 magicValue);
}

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title SpikePolicy
/// @notice Minimal ERC-1271 policy contract for Stage 0 spike: holds USDC and approves EIP-712 digests on-chain.
contract SpikePolicy is IERC1271 {
    bytes4 internal constant MAGIC_VALUE = 0x1626ba7e;
    bytes4 internal constant INVALID_SIGNATURE = 0xffffffff;

    address public immutable owner;
    address public agent;

    mapping(bytes32 => bool) public approved;

    event Approved(bytes32 indexed digest, address indexed approver);
    event AgentUpdated(address indexed previousAgent, address indexed newAgent);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    error Unauthorized();
    error ZeroAddress();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyApprover() {
        if (msg.sender != owner && msg.sender != agent) revert Unauthorized();
        _;
    }

    constructor(address _agent) {
        owner = msg.sender;
        agent = _agent;
        emit AgentUpdated(address(0), _agent);
    }

    function setAgent(address _agent) external onlyOwner {
        if (_agent == address(0)) revert ZeroAddress();
        address prev = agent;
        agent = _agent;
        emit AgentUpdated(prev, _agent);
    }

    /// @notice Approves an EIP-712 digest so USDC's ERC-1271 check passes.
    function approve(bytes32 digest) external onlyApprover {
        approved[digest] = true;
        emit Approved(digest, msg.sender);
    }

    /// @inheritdoc IERC1271
    function isValidSignature(bytes32 hash, bytes calldata) external view override returns (bytes4) {
        return approved[hash] ? MAGIC_VALUE : INVALID_SIGNATURE;
    }

    /// @notice Allows the owner to reclaim test tokens after the spike.
    function withdraw(address token, uint256 amount) external onlyOwner {
        bool ok = IERC20(token).transfer(owner, amount);
        if (!ok) revert TransferFailed();
        emit Withdrawn(token, owner, amount);
    }
}
