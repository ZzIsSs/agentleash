// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AgentPolicy} from "../src/AgentPolicy.sol";
import {AgentPolicyFactory} from "../src/AgentPolicyFactory.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract AgentPolicyTest is Test {
    AgentPolicy internal policy;
    AgentPolicyFactory internal factory;
    MockUSDC internal usdc;

    address internal owner = address(0xAA11);
    address internal agent = address(0xBB22);
    address internal attacker = address(0xDEADC0DE);
    address internal trustedVendor = address(0xCC33);
    address internal sandboxVendor = address(0xDD44);

    uint256 internal constant PER_TX_CAP = 10_000;         // 0.010 USDC
    uint256 internal constant DAILY_CAP = 30_000;          // 0.030 USDC
    uint256 internal constant SANDBOX_PER_TX = 2_000;      // 0.002 USDC
    uint256 internal constant SANDBOX_DAILY = 5_000;       // 0.005 USDC
    uint256 internal constant PERIOD = 30 seconds;         // Demo period
    uint256 internal constant INITIAL_USDC = 1_000_000;    // 1.000 USDC

    bytes4 internal constant ERC1271_MAGIC_VALUE = 0x1626ba7e;
    bytes4 internal constant ERC1271_INVALID = 0xffffffff;

    function setUp() public {
        vm.warp(1_700_000_000); // Fixed timestamp for determinism

        usdc = new MockUSDC();
        factory = new AgentPolicyFactory(address(usdc));

        vm.prank(owner);
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

        // Fund policy with USDC
        usdc.mint(address(policy), INITIAL_USDC);

        // Whitelist trusted vendor
        vm.prank(owner);
        policy.setWhitelist(trustedVendor, true);
    }

    // ==========================================
    // 1. CONSTRUCTOR & INITIAL STATE
    // ==========================================

    function test_Constructor_Success() public view {
        assertEq(policy.owner(), owner);
        assertEq(policy.agent(), agent);
        assertEq(address(policy.usdc()), address(usdc));
        assertEq(policy.perTxCap(), PER_TX_CAP);
        assertEq(policy.dailyCap(), DAILY_CAP);
        assertEq(policy.sandboxPerTxCap(), SANDBOX_PER_TX);
        assertEq(policy.sandboxDailyCap(), SANDBOX_DAILY);
        assertEq(policy.period(), PERIOD);
        assertEq(policy.periodStart(), block.timestamp);
        assertFalse(policy.paused());
        assertTrue(policy.whitelist(trustedVendor));
        assertFalse(policy.whitelist(sandboxVendor));
    }

    function test_Constructor_RevertIf_ZeroAddress() public {
        vm.expectRevert(AgentPolicy.ZeroAddress.selector);
        new AgentPolicy(address(0), agent, address(usdc), PER_TX_CAP, DAILY_CAP, SANDBOX_PER_TX, SANDBOX_DAILY, PERIOD);

        vm.expectRevert(AgentPolicy.ZeroAddress.selector);
        new AgentPolicy(owner, address(0), address(usdc), PER_TX_CAP, DAILY_CAP, SANDBOX_PER_TX, SANDBOX_DAILY, PERIOD);

        vm.expectRevert(AgentPolicy.ZeroAddress.selector);
        new AgentPolicy(owner, agent, address(0), PER_TX_CAP, DAILY_CAP, SANDBOX_PER_TX, SANDBOX_DAILY, PERIOD);
    }

    function test_Constructor_RevertIf_InvalidPeriod() public {
        vm.expectRevert(AgentPolicy.InvalidPeriod.selector);
        new AgentPolicy(owner, agent, address(usdc), PER_TX_CAP, DAILY_CAP, SANDBOX_PER_TX, SANDBOX_DAILY, 0);
    }

    function test_Constructor_RevertIf_InvalidCaps() public {
        // perTxCap > dailyCap
        vm.expectRevert(AgentPolicy.InvalidCaps.selector);
        new AgentPolicy(owner, agent, address(usdc), 40_000, 30_000, SANDBOX_PER_TX, SANDBOX_DAILY, PERIOD);

        // sandboxPerTxCap > sandboxDailyCap
        vm.expectRevert(AgentPolicy.InvalidCaps.selector);
        new AgentPolicy(owner, agent, address(usdc), PER_TX_CAP, DAILY_CAP, 6_000, 5_000, PERIOD);

        // sandboxDailyCap > dailyCap
        vm.expectRevert(AgentPolicy.InvalidCaps.selector);
        new AgentPolicy(owner, agent, address(usdc), PER_TX_CAP, DAILY_CAP, SANDBOX_PER_TX, 40_000, PERIOD);
    }

    // ==========================================
    // 2. AUTHORIZE: TRUSTED VENDOR (WHITELIST)
    // ==========================================

    function test_Authorize_Trusted_Success() public {
        uint256 amount = 8_000;
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 20;
        bytes32 nonce = keccak256("nonce-1");

        bytes32 expectedDigest = policy.getDigest(trustedVendor, amount, validAfter, validBefore, nonce);

        vm.prank(agent);
        bytes32 digest = policy.authorize(trustedVendor, amount, validAfter, validBefore, nonce);

        assertEq(digest, expectedDigest);
        assertEq(policy.spentInPeriod(), amount);
        assertEq(policy.sandboxSpentInPeriod(), 0);
        assertEq(policy.approvedUntil(digest), validBefore);
        assertFalse(policy.isSandboxAuthorization(digest));
        assertEq(policy.isValidSignature(digest, ""), ERC1271_MAGIC_VALUE);
    }

    function test_Authorize_RevertIf_ExceedsPerTxCap_Trusted() public {
        uint256 amount = PER_TX_CAP + 1; // 10_001 > 10_000
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 20;
        bytes32 nonce = keccak256("nonce-exceed-per-tx");

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AgentPolicy.ExceedsPerTxCap.selector, amount, PER_TX_CAP));
        policy.authorize(trustedVendor, amount, validAfter, validBefore, nonce);
    }

    function test_Authorize_RevertIf_ExceedsDailyCap_Trusted() public {
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 20;

        // Authorize 3 txs of 10_000 = 30_000 (reaching daily cap)
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(agent);
            policy.authorize(trustedVendor, 10_000, validAfter, validBefore, bytes32(i + 1));
        }
        assertEq(policy.spentInPeriod(), 30_000);

        // 4th tx exceeds daily cap
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AgentPolicy.ExceedsDailyCap.selector, 31_000, DAILY_CAP));
        policy.authorize(trustedVendor, 1_000, validAfter, validBefore, bytes32(uint256(4)));
    }

    // ==========================================
    // 3. AUTHORIZE: SANDBOX RECIPIENT
    // ==========================================

    function test_Authorize_Sandbox_Success() public {
        uint256 amount = 1_500; // <= sandboxPerTxCap (2_000)
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 20;
        bytes32 nonce = keccak256("nonce-sandbox-1");

        vm.prank(agent);
        bytes32 digest = policy.authorize(sandboxVendor, amount, validAfter, validBefore, nonce);

        assertEq(policy.spentInPeriod(), amount);
        assertEq(policy.sandboxSpentInPeriod(), amount);
        assertTrue(policy.isSandboxAuthorization(digest));
        assertEq(policy.isValidSignature(digest, ""), ERC1271_MAGIC_VALUE);
    }

    function test_Authorize_RevertIf_ExceedsSandboxPerTxCap() public {
        uint256 amount = SANDBOX_PER_TX + 1; // 2_001 > 2_000
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 20;

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AgentPolicy.ExceedsSandboxPerTxCap.selector, amount, SANDBOX_PER_TX));
        policy.authorize(sandboxVendor, amount, validAfter, validBefore, bytes32("nonce"));
    }

    function test_Authorize_RevertIf_ExceedsSandboxDailyCap() public {
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 20;

        // Authorize 2 sandbox txs of 2_000 = 4_000
        vm.prank(agent);
        policy.authorize(sandboxVendor, 2_000, validAfter, validBefore, bytes32(uint256(1)));
        vm.prank(agent);
        policy.authorize(sandboxVendor, 2_000, validAfter, validBefore, bytes32(uint256(2)));

        // 3rd sandbox tx of 1_500 => 4_000 + 1_500 = 5_500 > SANDBOX_DAILY (5_000)
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AgentPolicy.ExceedsSandboxDailyCap.selector, 5_500, SANDBOX_DAILY));
        policy.authorize(sandboxVendor, 1_500, validAfter, validBefore, bytes32(uint256(3)));
    }

    function test_Authorize_RevertIf_SandboxExceedsOverallDailyCap() public {
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 20;

        // Spend 29_000 on trusted vendor first
        vm.prank(agent);
        policy.authorize(trustedVendor, 10_000, validAfter, validBefore, bytes32(uint256(1)));
        vm.prank(agent);
        policy.authorize(trustedVendor, 10_000, validAfter, validBefore, bytes32(uint256(2)));
        vm.prank(agent);
        policy.authorize(trustedVendor, 9_000, validAfter, validBefore, bytes32(uint256(3)));

        // Now sandbox tries 1_500 (which is <= sandboxPerTx and <= sandboxDaily), but 29_000 + 1_500 = 30_500 > dailyCap (30_000)
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AgentPolicy.ExceedsDailyCap.selector, 30_500, DAILY_CAP));
        policy.authorize(sandboxVendor, 1_500, validAfter, validBefore, bytes32(uint256(4)));
    }

    // ==========================================
    // 4. ACCESS CONTROL & VALIDATIONS
    // ==========================================

    function test_Authorize_RevertIf_CallerNotAgent() public {
        vm.prank(attacker);
        vm.expectRevert(AgentPolicy.Unauthorized.selector);
        policy.authorize(trustedVendor, 1_000, block.timestamp, block.timestamp + 20, bytes32("nonce"));

        vm.prank(owner);
        vm.expectRevert(AgentPolicy.Unauthorized.selector);
        policy.authorize(trustedVendor, 1_000, block.timestamp, block.timestamp + 20, bytes32("nonce"));
    }

    function test_Authorize_RevertIf_InvalidParameters() public {
        vm.startPrank(agent);

        // Zero address payTo
        vm.expectRevert(AgentPolicy.ZeroAddress.selector);
        policy.authorize(address(0), 1_000, block.timestamp, block.timestamp + 20, bytes32("1"));

        // Zero amount
        vm.expectRevert(AgentPolicy.ZeroAmount.selector);
        policy.authorize(trustedVendor, 0, block.timestamp, block.timestamp + 20, bytes32("2"));

        // validBefore <= validAfter
        vm.expectRevert(AgentPolicy.InvalidTimeBounds.selector);
        policy.authorize(trustedVendor, 1_000, block.timestamp + 10, block.timestamp + 5, bytes32("3"));

        // validBefore <= block.timestamp
        vm.expectRevert(AgentPolicy.InvalidTimeBounds.selector);
        policy.authorize(trustedVendor, 1_000, block.timestamp - 10, block.timestamp, bytes32("4"));

        vm.stopPrank();
    }

    function test_Authorize_RevertIf_AlreadyApproved() public {
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 20;
        bytes32 nonce = bytes32("duplicate");

        vm.prank(agent);
        policy.authorize(trustedVendor, 1_000, validAfter, validBefore, nonce);

        // Duplicate call
        vm.prank(agent);
        vm.expectRevert(AgentPolicy.AlreadyApproved.selector);
        policy.authorize(trustedVendor, 1_000, validAfter, validBefore, nonce);
    }

    // ==========================================
    // 5. KILL SWITCH (PAUSE / UNPAUSE) & EXPIRATION
    // ==========================================

    function test_KillSwitch_PauseAndUnpause() public {
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 20;
        bytes32 nonce = bytes32("pre-pause");

        vm.prank(agent);
        bytes32 digest = policy.authorize(trustedVendor, 1_000, validAfter, validBefore, nonce);

        // Digest is valid before pause
        assertEq(policy.isValidSignature(digest, ""), ERC1271_MAGIC_VALUE);

        // Owner pauses
        vm.prank(owner);
        policy.pause();
        assertTrue(policy.paused());

        // During pause: authorize reverts
        vm.prank(agent);
        vm.expectRevert(AgentPolicy.PausedError.selector);
        policy.authorize(trustedVendor, 1_000, validAfter, validBefore, bytes32("during-pause"));

        // During pause: previously approved digest is rejected!
        assertEq(policy.isValidSignature(digest, ""), ERC1271_INVALID);

        // Owner unpauses
        vm.prank(owner);
        policy.unpause();
        assertFalse(policy.paused());

        // Previously approved digest is valid again (since not yet expired)
        assertEq(policy.isValidSignature(digest, ""), ERC1271_MAGIC_VALUE);
    }

    function test_IsValidSignature_Expired() public {
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 10;
        bytes32 nonce = bytes32("expiring");

        vm.prank(agent);
        bytes32 digest = policy.authorize(trustedVendor, 1_000, validAfter, validBefore, nonce);

        assertEq(policy.isValidSignature(digest, ""), ERC1271_MAGIC_VALUE);

        // Fast-forward past validBefore
        vm.warp(validBefore + 1);
        assertEq(policy.isValidSignature(digest, ""), ERC1271_INVALID);
    }

    // ==========================================
    // 6. PERIOD ROLLOVER
    // ==========================================

    function test_PeriodRollover_ResetsBudgets() public {
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 20;

        // Spend up to daily cap
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(agent);
            policy.authorize(trustedVendor, 10_000, validAfter, validBefore, bytes32(i + 1));
        }
        assertEq(policy.spentInPeriod(), DAILY_CAP);

        // Cannot spend anymore in current period
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AgentPolicy.ExceedsDailyCap.selector, 31_000, DAILY_CAP));
        policy.authorize(trustedVendor, 1_000, validAfter, validBefore, bytes32("fail"));

        // Warp to next period
        vm.warp(block.timestamp + PERIOD);

        // Authorize resets spent amounts and succeeds
        uint256 newValidAfter = block.timestamp;
        uint256 newValidBefore = block.timestamp + 20;
        vm.prank(agent);
        policy.authorize(trustedVendor, 5_000, newValidAfter, newValidBefore, bytes32("new-period"));

        assertEq(policy.spentInPeriod(), 5_000);
        assertEq(policy.sandboxSpentInPeriod(), 0);
        assertEq(policy.periodStart(), block.timestamp);
    }

    // ==========================================
    // 7. RELEASE (REFUND UNUSED AUTHORIZATION)
    // ==========================================

    function test_Release_Success() public {
        uint256 amount = 1_500;
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 10;
        bytes32 nonce = bytes32("release-me");

        vm.prank(agent);
        bytes32 digest = policy.authorize(sandboxVendor, amount, validAfter, validBefore, nonce);

        assertEq(policy.spentInPeriod(), amount);
        assertEq(policy.sandboxSpentInPeriod(), amount);

        // Fast forward past validBefore
        vm.warp(validBefore + 1);

        // Release can be called by anyone
        policy.release(nonce, sandboxVendor, amount, validAfter, validBefore);

        // State is cleared and refunded
        assertEq(policy.approvedUntil(digest), 0);
        assertEq(policy.spentInPeriod(), 0);
        assertEq(policy.sandboxSpentInPeriod(), 0);
    }

    function test_Release_RevertIf_NotExpired() public {
        uint256 amount = 1_000;
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 10;
        bytes32 nonce = bytes32("not-yet");

        vm.prank(agent);
        policy.authorize(trustedVendor, amount, validAfter, validBefore, nonce);

        // Try releasing while still valid
        vm.expectRevert(AgentPolicy.NotExpired.selector);
        policy.release(nonce, trustedVendor, amount, validAfter, validBefore);
    }

    function test_Release_RevertIf_AlreadyUsedOnChain() public {
        uint256 amount = 1_000;
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 10;
        bytes32 nonce = bytes32("spent-on-usdc");

        vm.prank(agent);
        policy.authorize(trustedVendor, amount, validAfter, validBefore, nonce);

        // Advance to valid window
        vm.warp(validAfter + 1);

        // USDC executes transferWithAuthorization
        usdc.transferWithAuthorization(
            address(policy),
            trustedVendor,
            amount,
            validAfter,
            validBefore,
            nonce,
            ""
        );

        // Fast forward past expiration
        vm.warp(validBefore + 1);

        // Release must revert because it was used on USDC
        vm.expectRevert(AgentPolicy.AlreadyUsedOnChain.selector);
        policy.release(nonce, trustedVendor, amount, validAfter, validBefore);
    }

    function test_Release_RevertIf_NotApproved() public {
        bytes32 nonce = bytes32("never-approved");
        vm.expectRevert(AgentPolicy.NotApproved.selector);
        policy.release(nonce, trustedVendor, 1_000, block.timestamp - 20, block.timestamp - 10);
    }

    // ==========================================
    // 8. MANAGEMENT & WITHDRAWALS
    // ==========================================

    function test_Withdraw_OnlyOwner() public {
        uint256 withdrawAmount = 500_000;

        vm.prank(attacker);
        vm.expectRevert(AgentPolicy.Unauthorized.selector);
        policy.withdraw(withdrawAmount);

        uint256 ownerBefore = usdc.balanceOf(owner);
        uint256 policyBefore = usdc.balanceOf(address(policy));

        vm.prank(owner);
        policy.withdraw(withdrawAmount);

        assertEq(usdc.balanceOf(owner), ownerBefore + withdrawAmount);
        assertEq(usdc.balanceOf(address(policy)), policyBefore - withdrawAmount);
    }

    function test_SetCaps_And_SetWhitelist_And_SetAgent() public {
        vm.startPrank(owner);

        policy.setWhitelist(sandboxVendor, true);
        assertTrue(policy.whitelist(sandboxVendor));

        policy.setCaps(15_000, 40_000, 3_000, 8_000);
        assertEq(policy.perTxCap(), 15_000);
        assertEq(policy.dailyCap(), 40_000);
        assertEq(policy.sandboxPerTxCap(), 3_000);
        assertEq(policy.sandboxDailyCap(), 8_000);

        address newAgent = address(0x9999);
        policy.setAgent(newAgent);
        assertEq(policy.agent(), newAgent);

        vm.stopPrank();

        // Non-owner cannot update
        vm.prank(attacker);
        vm.expectRevert(AgentPolicy.Unauthorized.selector);
        policy.setWhitelist(sandboxVendor, false);
    }

    // ==========================================
    // 9. FACTORY TESTS
    // ==========================================

    function test_Factory_CreatePolicy() public {
        address user = address(0xCAFE);
        address userAgent = address(0xBEEF);

        vm.prank(user);
        address newPolicyAddr = factory.createPolicy(
            userAgent,
            5_000,
            15_000,
            1_000,
            3_000,
            60
        );

        AgentPolicy newPolicy = AgentPolicy(newPolicyAddr);
        assertEq(newPolicy.owner(), user);
        assertEq(newPolicy.agent(), userAgent);
        assertEq(address(newPolicy.usdc()), address(usdc));
        assertEq(factory.allPoliciesLength(), 1);

        address[] memory userPolicies = factory.getPoliciesByOwner(user);
        assertEq(userPolicies.length, 1);
        assertEq(userPolicies[0], newPolicyAddr);
    }
}
