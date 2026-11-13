// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {AgentPolicy, IFiatToken} from "../src/AgentPolicy.sol";

/// @title AgentPolicyForkTest
/// @notice Integration fork test on Avalanche Fuji C-Chain with real Circle USDC (FiatTokenV2_2)
contract AgentPolicyForkTest is Test {
    address internal constant FUJI_USDC = 0x5425890298aed601595a70AB815c96711a31Bc65;
    string internal constant FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";

    // Known holder from Stage 0 spike (holds 0.008 USDC)
    address internal constant SPIKE_POLICY_HOLDER = 0x38706AFC0f92b6908389ebF377aab688a2BDe951;

    AgentPolicy internal policy;
    IFiatToken internal usdc;

    address internal owner = address(0xAA11);
    address internal agent = address(0xBB22);
    address internal weatherVendor = 0x9D014376C3296db41770015AF074CF4D14c075E1;
    address internal facilitatorRelayer = 0xa58c2Dcc274Ee68744Cb81e7a8E02b487d277fd3;

    uint256 internal constant PER_TX_CAP = 5_000;      // 0.005 USDC
    uint256 internal constant DAILY_CAP = 20_000;      // 0.020 USDC
    uint256 internal constant SANDBOX_PER_TX = 1_000;  // 0.001 USDC
    uint256 internal constant SANDBOX_DAILY = 3_000;   // 0.003 USDC
    uint256 internal constant PERIOD = 30 seconds;

    uint256 internal forkId;

    function setUp() public {
        // Create and select Fuji fork
        string memory rpcUrl = vm.envOr("FUJI_RPC_URL", FUJI_RPC);
        forkId = vm.createSelectFork(rpcUrl);

        usdc = IFiatToken(FUJI_USDC);

        // Deploy fresh AgentPolicy on fork
        vm.prank(owner);
        policy = new AgentPolicy(
            owner,
            agent,
            FUJI_USDC,
            PER_TX_CAP,
            DAILY_CAP,
            SANDBOX_PER_TX,
            SANDBOX_DAILY,
            PERIOD
        );

        // Fund policy with 0.005 USDC (5,000 units) from spike policy holder
        vm.prank(SPIKE_POLICY_HOLDER);
        usdc.transfer(address(policy), 5_000);

        // Whitelist weather vendor
        vm.prank(owner);
        policy.setWhitelist(weatherVendor, true);
    }

    /// @notice Test full EIP-3009 transferWithAuthorization execution on real Fuji USDC using ERC-1271
    function test_Fork_RealUSDC_TransferWithAuthorization_Success() public {
        uint256 amount = 1_000; // 0.001 USDC (matching weather API price)
        uint256 validAfter = block.timestamp - 1;
        uint256 validBefore = block.timestamp + 300;
        bytes32 nonce = keccak256(abi.encodePacked("fork-test-nonce-1", block.timestamp));

        // 1. Agent authorizes payment on Policy contract
        vm.prank(agent);
        bytes32 digest = policy.authorize(weatherVendor, amount, validAfter, validBefore, nonce);

        // Verify ERC-1271 magic value
        assertEq(policy.isValidSignature(digest, ""), bytes4(0x1626ba7e));

        uint256 policyBalBefore = usdc.balanceOf(address(policy));
        uint256 vendorBalBefore = usdc.balanceOf(weatherVendor);

        // 2. Facilitator submits transferWithAuthorization to real USDC on Fuji
        // Passing signature = "" (dummy signature for ERC-1271 contract wallet)
        vm.prank(facilitatorRelayer);
        usdc.transferWithAuthorization(
            address(policy),
            weatherVendor,
            amount,
            validAfter,
            validBefore,
            nonce,
            ""
        );

        // 3. Verify real state changes on USDC
        assertEq(usdc.balanceOf(address(policy)), policyBalBefore - amount);
        assertEq(usdc.balanceOf(weatherVendor), vendorBalBefore + amount);
        assertTrue(usdc.authorizationState(address(policy), nonce));
    }

    /// @notice Test that pausing policy prevents real USDC from executing transferWithAuthorization
    function test_Fork_RealUSDC_PausedPolicy_BlocksTransfer() public {
        uint256 amount = 1_000;
        uint256 validAfter = block.timestamp - 1;
        uint256 validBefore = block.timestamp + 300;
        bytes32 nonce = keccak256(abi.encodePacked("fork-test-pause-nonce", block.timestamp));

        // 1. Agent authorizes payment
        vm.prank(agent);
        policy.authorize(weatherVendor, amount, validAfter, validBefore, nonce);

        // 2. Owner hits emergency Kill Switch
        vm.prank(owner);
        policy.pause();

        // 3. Facilitator attempts settlement on Fuji USDC -> Must revert because ERC-1271 returns 0xffffffff
        vm.prank(facilitatorRelayer);
        vm.expectRevert("FiatTokenV2: invalid signature");
        usdc.transferWithAuthorization(
            address(policy),
            weatherVendor,
            amount,
            validAfter,
            validBefore,
            nonce,
            ""
        );
    }
}
