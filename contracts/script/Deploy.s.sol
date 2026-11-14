// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {AgentPolicy, IFiatToken} from "../src/AgentPolicy.sol";
import {AgentPolicyFactory} from "../src/AgentPolicyFactory.sol";

/// @title Deploy
/// @author Nguyen (AgentLeash Technical Lead)
/// @notice Deployment script for AgentPolicyFactory and a sample demo AgentPolicy on Avalanche Fuji.
contract Deploy is Script {
    address internal constant DEFAULT_FUJI_USDC = 0x5425890298aed601595a70AB815c96711a31Bc65;
    address internal constant DEFAULT_WEATHER_VENDOR = 0x9D014376C3296db41770015AF074CF4D14c075E1;

    struct Config {
        address deployer;
        address agent;
        address usdc;
        address vendor;
        uint256 period;
        uint256 perTxCap;
        uint256 dailyCap;
        uint256 sandboxPerTxCap;
        uint256 sandboxDailyCap;
    }

    function run() external returns (AgentPolicyFactory factory, AgentPolicy policy) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        Config memory cfg;

        cfg.deployer = vm.addr(deployerKey);
        uint256 agentKey = vm.envOr("AGENT_PRIVATE_KEY", uint256(0));
        cfg.agent = agentKey != 0 ? vm.addr(agentKey) : vm.envOr("AGENT_ADDRESS", cfg.deployer);
        cfg.usdc = vm.envOr("USDC_ADDRESS", DEFAULT_FUJI_USDC);
        cfg.vendor = vm.envOr("WEATHER_VENDOR_ADDRESS", DEFAULT_WEATHER_VENDOR);

        cfg.period = vm.envOr("PERIOD_SECONDS", uint256(30)); // 30s demo cycle
        cfg.perTxCap = vm.envOr("PER_TX_CAP", uint256(10_000)); // 0.010 USDC
        cfg.dailyCap = vm.envOr("DAILY_CAP", uint256(30_000)); // 0.030 USDC
        cfg.sandboxPerTxCap = vm.envOr("SANDBOX_PER_TX_CAP", uint256(2_000)); // 0.002 USDC
        cfg.sandboxDailyCap = vm.envOr("SANDBOX_DAILY_CAP", uint256(5_000)); // 0.005 USDC

        vm.startBroadcast(deployerKey);

        // 1. Deploy Factory
        factory = new AgentPolicyFactory(cfg.usdc);

        // 2. Deploy sample AgentPolicy via Factory
        address policyAddr = factory.createPolicy(
            cfg.agent,
            cfg.perTxCap,
            cfg.dailyCap,
            cfg.sandboxPerTxCap,
            cfg.sandboxDailyCap,
            cfg.period
        );
        policy = AgentPolicy(policyAddr);

        // 3. Whitelist weather vendor by default
        policy.setWhitelist(cfg.vendor, true);

        // 4. Optionally fund policy if deployer holds USDC
        IFiatToken usdcToken = IFiatToken(cfg.usdc);
        uint256 balance = usdcToken.balanceOf(cfg.deployer);
        if (balance >= 10_000) {
            bool ok = usdcToken.transfer(policyAddr, 10_000);
            if (ok) {
                console2.log("Funded Policy with 0.01 USDC");
            }
        }

        vm.stopBroadcast();

        console2.log("=== AgentLeash Deployment Complete ===");
        console2.log("Factory:", address(factory));
        console2.log("Sample Policy:", policyAddr);
        console2.log("Owner:", cfg.deployer);
        console2.log("Agent:", cfg.agent);
        console2.log("Period (s):", cfg.period);
        console2.log("Policy USDC Balance:", usdcToken.balanceOf(policyAddr));
    }
}
