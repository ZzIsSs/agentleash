// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC1271 {
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4 magicValue);
}

interface IFiatToken {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool);
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external;
}

/// @title AgentPolicy
/// @author Nguyen (AgentLeash Technical Lead)
/// @notice Non-custodial budget & policy guardrail contract for autonomous AI agents paying via x402 on Avalanche Fuji.
/// @dev Holds USDC, authorizes EIP-3009 transfer authorizations, and verifies via ERC-1271 (FiatTokenV2_2 compatible).
contract AgentPolicy is IERC1271 {
    bytes4 internal constant MAGIC_VALUE = 0x1626ba7e;
    bytes4 internal constant INVALID_SIGNATURE = 0xffffffff;

    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    address public immutable owner;
    address public agent;
    IFiatToken public immutable usdc;

    // Tiered caps (in token decimals, 6 for USDC)
    uint256 public perTxCap;           // Max per-tx cap for Whitelisted (Trusted) addresses
    uint256 public dailyCap;           // Overall cap per period (Trusted + Sandbox)
    uint256 public sandboxPerTxCap;    // Max per-tx cap for non-whitelisted (Sandbox) addresses
    uint256 public sandboxDailyCap;    // Max period cap dedicated to non-whitelisted addresses
    uint256 public immutable period;   // Period length in seconds (e.g., 30s in demo, 1 days in production)

    uint256 public spentInPeriod;
    uint256 public sandboxSpentInPeriod;
    uint256 public periodStart;

    mapping(address => bool) public whitelist;
    mapping(bytes32 => uint256) public approvedUntil;         // digest => validBefore timestamp
    mapping(bytes32 => bool) public isSandboxAuthorization;   // digest => isSandbox
    mapping(bytes32 => uint256) public authorizationPeriodStart; // digest => periodStart when approved
    mapping(bytes32 => uint256) public authorizationAmount;   // digest => amount authorized

    bool public paused;

    // Events
    event Authorized(
        bytes32 indexed digest,
        address indexed payTo,
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bool isSandbox
    );
    event Released(bytes32 indexed nonce, address indexed payTo, uint256 amount, bytes32 indexed digest);
    event Paused(address indexed account);
    event Unpaused(address indexed account);
    event WhitelistChanged(address indexed target, bool allowed);
    event CapsChanged(uint256 perTxCap, uint256 dailyCap, uint256 sandboxPerTxCap, uint256 sandboxDailyCap);
    event AgentUpdated(address indexed previousAgent, address indexed newAgent);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);
    event PeriodRolledOver(uint256 newPeriodStart);

    // Custom Errors
    error Unauthorized();
    error PausedError();
    error NotPausedError();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidCaps();
    error InvalidPeriod();
    error InvalidTimeBounds();
    error AlreadyApproved();
    error NotApproved();
    error NotExpired();
    error AlreadyUsedOnChain();
    error ExceedsPerTxCap(uint256 requested, uint256 cap);
    error ExceedsDailyCap(uint256 requestedTotal, uint256 cap);
    error ExceedsSandboxPerTxCap(uint256 requested, uint256 cap);
    error ExceedsSandboxDailyCap(uint256 requestedTotal, uint256 cap);
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyAgent() {
        if (msg.sender != agent) revert Unauthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert PausedError();
        _;
    }

    modifier whenPaused() {
        if (!paused) revert NotPausedError();
        _;
    }

    constructor(
        address _owner,
        address _agent,
        address _usdc,
        uint256 _perTxCap,
        uint256 _dailyCap,
        uint256 _sandboxPerTxCap,
        uint256 _sandboxDailyCap,
        uint256 _period
    ) {
        if (_owner == address(0) || _agent == address(0) || _usdc == address(0)) revert ZeroAddress();
        if (_period == 0) revert InvalidPeriod();
        if (_perTxCap > _dailyCap || _sandboxPerTxCap > _sandboxDailyCap || _sandboxDailyCap > _dailyCap) {
            revert InvalidCaps();
        }

        owner = _owner;
        agent = _agent;
        usdc = IFiatToken(_usdc);

        perTxCap = _perTxCap;
        dailyCap = _dailyCap;
        sandboxPerTxCap = _sandboxPerTxCap;
        sandboxDailyCap = _sandboxDailyCap;
        period = _period;

        periodStart = block.timestamp;

        emit AgentUpdated(address(0), _agent);
        emit CapsChanged(_perTxCap, _dailyCap, _sandboxPerTxCap, _sandboxDailyCap);
        emit PeriodRolledOver(periodStart);
    }

    /// @notice Computes EIP-712 TransferWithAuthorization digest matching USDC Fuji
    function getDigest(
        address payTo,
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
                address(this),
                payTo,
                amount,
                validAfter,
                validBefore,
                nonce
            )
        );
        return keccak256(
            abi.encodePacked(
                "\x19\x01",
                usdc.DOMAIN_SEPARATOR(),
                structHash
            )
        );
    }

    /// @dev Rollover period budget if current time exceeded periodStart + period
    function _rolloverIfNeeded() internal {
        if (block.timestamp >= periodStart + period) {
            periodStart = block.timestamp;
            spentInPeriod = 0;
            sandboxSpentInPeriod = 0;
            emit PeriodRolledOver(periodStart);
        }
    }

    /// @notice Explicitly trigger period rollover if expired
    function rolloverPeriod() external {
        _rolloverIfNeeded();
    }

    /// @notice Authorize an x402 payment according to tiered policy guardrails
    /// @param payTo Beneficiary address
    /// @param amount Payment amount in USDC units
    /// @param validAfter Earliest time authorization can be executed
    /// @param validBefore Expiration time of authorization
    /// @param nonce Unique random authorization nonce
    function authorize(
        address payTo,
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce
    ) external onlyAgent whenNotPaused returns (bytes32 digest) {
        if (payTo == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (validBefore <= validAfter || validBefore <= block.timestamp) revert InvalidTimeBounds();

        _rolloverIfNeeded();

        digest = getDigest(payTo, amount, validAfter, validBefore, nonce);
        if (approvedUntil[digest] != 0) revert AlreadyApproved();

        bool isTrusted = whitelist[payTo];
        if (isTrusted) {
            if (amount > perTxCap) revert ExceedsPerTxCap(amount, perTxCap);
            if (spentInPeriod + amount > dailyCap) revert ExceedsDailyCap(spentInPeriod + amount, dailyCap);
            spentInPeriod += amount;
        } else {
            if (amount > sandboxPerTxCap) revert ExceedsSandboxPerTxCap(amount, sandboxPerTxCap);
            if (sandboxSpentInPeriod + amount > sandboxDailyCap) {
                revert ExceedsSandboxDailyCap(sandboxSpentInPeriod + amount, sandboxDailyCap);
            }
            if (spentInPeriod + amount > dailyCap) {
                revert ExceedsDailyCap(spentInPeriod + amount, dailyCap);
            }
            spentInPeriod += amount;
            sandboxSpentInPeriod += amount;
            isSandboxAuthorization[digest] = true;
        }

        approvedUntil[digest] = validBefore;
        authorizationPeriodStart[digest] = periodStart;
        authorizationAmount[digest] = amount;

        emit Authorized(digest, payTo, amount, validAfter, validBefore, nonce, !isTrusted);
    }

    /// @notice Release and refund unspent authorization budget after validBefore expired
    /// @param nonce The authorization nonce
    /// @param payTo The original beneficiary
    /// @param amount The original amount
    /// @param validAfter The original validAfter
    /// @param validBefore The original validBefore
    function release(
        bytes32 nonce,
        address payTo,
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore
    ) external {
        bytes32 digest = getDigest(payTo, amount, validAfter, validBefore, nonce);
        uint256 expiry = approvedUntil[digest];
        if (expiry == 0) revert NotApproved();
        if (block.timestamp <= expiry) revert NotExpired();

        // Check if nonce was already spent on USDC
        if (usdc.authorizationState(address(this), nonce)) revert AlreadyUsedOnChain();

        // Clear approval state
        approvedUntil[digest] = 0;

        _rolloverIfNeeded();

        // Refund budget only if we are still within the same period in which it was authorized
        if (authorizationPeriodStart[digest] == periodStart) {
            if (spentInPeriod >= amount) {
                spentInPeriod -= amount;
            } else {
                spentInPeriod = 0;
            }

            if (isSandboxAuthorization[digest]) {
                if (sandboxSpentInPeriod >= amount) {
                    sandboxSpentInPeriod -= amount;
                } else {
                    sandboxSpentInPeriod = 0;
                }
            }
        }

        emit Released(nonce, payTo, amount, digest);
    }

    /// @inheritdoc IERC1271
    /// @dev Returns MAGIC_VALUE (0x1626ba7e) if contract is not paused and digest is currently approved
    function isValidSignature(bytes32 hash, bytes calldata) external view override returns (bytes4) {
        if (paused) return INVALID_SIGNATURE;
        if (approvedUntil[hash] >= block.timestamp) {
            return MAGIC_VALUE;
        }
        return INVALID_SIGNATURE;
    }

    /// @notice Emergency Kill Switch: immediately halts all pending and future authorizations
    function pause() external onlyOwner whenNotPaused {
        paused = true;
        emit Paused(msg.sender);
    }

    /// @notice Unpause the policy
    function unpause() external onlyOwner whenPaused {
        paused = false;
        emit Unpaused(msg.sender);
    }

    /// @notice Configure whitelisted (trusted) recipient address
    function setWhitelist(address payTo, bool allowed) external onlyOwner {
        if (payTo == address(0)) revert ZeroAddress();
        whitelist[payTo] = allowed;
        emit WhitelistChanged(payTo, allowed);
    }

    /// @notice Update tiered spending caps
    function setCaps(
        uint256 _perTxCap,
        uint256 _dailyCap,
        uint256 _sandboxPerTxCap,
        uint256 _sandboxDailyCap
    ) external onlyOwner {
        if (_perTxCap > _dailyCap || _sandboxPerTxCap > _sandboxDailyCap || _sandboxDailyCap > _dailyCap) {
            revert InvalidCaps();
        }
        perTxCap = _perTxCap;
        dailyCap = _dailyCap;
        sandboxPerTxCap = _sandboxPerTxCap;
        sandboxDailyCap = _sandboxDailyCap;
        emit CapsChanged(_perTxCap, _dailyCap, _sandboxPerTxCap, _sandboxDailyCap);
    }

    /// @notice Update agent address
    function setAgent(address _agent) external onlyOwner {
        if (_agent == address(0)) revert ZeroAddress();
        address prev = agent;
        agent = _agent;
        emit AgentUpdated(prev, _agent);
    }

    /// @notice Withdraw USDC to owner wallet
    function withdraw(uint256 amount) external onlyOwner {
        emit Withdrawn(address(usdc), owner, amount);
        bool ok = usdc.transfer(owner, amount);
        if (!ok) revert TransferFailed();
    }

    /// @notice Withdraw any ERC20 token to owner wallet
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        emit Withdrawn(token, owner, amount);
        bool ok = IFiatToken(token).transfer(owner, amount);
        if (!ok) revert TransferFailed();
    }

    /// @notice Convenience helper to inspect remaining budget in current period
    function getRemainingCaps() external view returns (
        uint256 remainingDaily,
        uint256 remainingSandboxDaily,
        uint256 currentPeriodStart
    ) {
        if (block.timestamp >= periodStart + period) {
            return (dailyCap, sandboxDailyCap, block.timestamp);
        }
        remainingDaily = spentInPeriod >= dailyCap ? 0 : dailyCap - spentInPeriod;
        remainingSandboxDaily = sandboxSpentInPeriod >= sandboxDailyCap ? 0 : sandboxDailyCap - sandboxSpentInPeriod;
        currentPeriodStart = periodStart;
    }
}
