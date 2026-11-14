// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {AgentPolicy} from "../src/AgentPolicy.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @title PolicyHandler
/// @notice Fuzz action handler generating randomized sequences of authorize calls and time warps.
contract PolicyHandler is Test {
    AgentPolicy public immutable policy;
    MockUSDC public immutable usdc;
    address public immutable agent;
    address public immutable trustedVendor;
    address public immutable sandboxVendor;

    uint256 public totalSuccessfulAuthorizations;
    uint256 public totalRevertedAuthorizations;

    uint256 private nonceCounter;

    constructor(
        AgentPolicy _policy,
        MockUSDC _usdc,
        address _agent,
        address _trustedVendor,
        address _sandboxVendor
    ) {
        policy = _policy;
        usdc = _usdc;
        agent = _agent;
        trustedVendor = _trustedVendor;
        sandboxVendor = _sandboxVendor;
    }

    function authorizeAction(
        uint256 recipientChoice,
        uint256 rawAmount,
        uint256 warpSeconds
    ) external {
        // Warp time optionally (up to 2x period to trigger rollovers)
        uint256 warp = warpSeconds % (policy.period() * 2 + 1);
        if (warp > 0) {
            vm.warp(block.timestamp + warp);
        }

        // Pick recipient: whitelisted vs sandbox
        address recipient = (recipientChoice % 2 == 0) ? trustedVendor : sandboxVendor;

        // Pick amount bounded reasonably between 1 and 2x daily cap
        uint256 amount = (rawAmount % (policy.dailyCap() * 2)) + 1;

        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 60;
        bytes32 nonce = keccak256(abi.encodePacked("nonce", ++nonceCounter, block.timestamp));

        vm.prank(agent);
        try policy.authorize(recipient, amount, validAfter, validBefore, nonce) {
            totalSuccessfulAuthorizations++;
        } catch {
            totalRevertedAuthorizations++;
        }
    }
}

/// @title AgentPolicyInvariantTest
/// @notice Invariant test suite verifying budget integrity across arbitrary fuzz call sequences.
contract AgentPolicyInvariantTest is StdInvariant, Test {
    AgentPolicy internal policy;
    MockUSDC internal usdc;
    PolicyHandler internal handler;

    address internal owner = address(0xAA11);
    address internal agent = address(0xBB22);
    address internal trustedVendor = address(0xCC33);
    address internal sandboxVendor = address(0xDD44);

    uint256 internal constant PER_TX_CAP = 5_000;
    uint256 internal constant DAILY_CAP = 20_000;
    uint256 internal constant SANDBOX_PER_TX = 1_000;
    uint256 internal constant SANDBOX_DAILY = 3_000;
    uint256 internal constant PERIOD = 30 seconds;

    function setUp() public {
        vm.warp(1_700_000_000);

        usdc = new MockUSDC();
        policy = new AgentPolicy(
            owner,
            agent,
            address(usdc),
            PER_TX_CAP,
            DAILY_CAP,
            SANDBOX_PER_TX,
            SANDBOX_DAILY,
            PERIOD
        );

        usdc.mint(address(policy), 1_000_000);

        vm.prank(owner);
        policy.setWhitelist(trustedVendor, true);

        handler = new PolicyHandler(policy, usdc, agent, trustedVendor, sandboxVendor);

        targetContract(address(handler));
    }

    /// @notice Invariant 1: Total spent in the current period never exceeds dailyCap
    function invariant_SpentInPeriodNeverExceedsDailyCap() public view {
        assertLe(policy.spentInPeriod(), policy.dailyCap(), "Invariant violated: spentInPeriod > dailyCap");
    }

    /// @notice Invariant 2: Total sandbox spent never exceeds sandboxDailyCap
    function invariant_SandboxSpentNeverExceedsSandboxDailyCap() public view {
        assertLe(
            policy.sandboxSpentInPeriod(),
            policy.sandboxDailyCap(),
            "Invariant violated: sandboxSpentInPeriod > sandboxDailyCap"
        );
    }

    /// @notice Invariant 3: Sandbox spent is always a subset of total spent
    function invariant_SandboxSpentNeverExceedsTotalSpent() public view {
        assertLe(
            policy.sandboxSpentInPeriod(),
            policy.spentInPeriod(),
            "Invariant violated: sandboxSpentInPeriod > spentInPeriod"
        );
    }
}
