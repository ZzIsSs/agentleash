// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {SpikePolicy, IERC20} from "../src/SpikePolicy.sol";

contract DeploySpike is Script {
    address internal constant DEFAULT_FUJI_USDC = 0x5425890298aed601595a70AB815c96711a31Bc65;
    uint256 internal constant INITIAL_FUNDING_USDC = 10_000; // 0.01 USDC (6 decimals)

    function run() external returns (SpikePolicy policy) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        uint256 agentKey = vm.envOr("AGENT_PRIVATE_KEY", uint256(0));
        address agentAddr = agentKey != 0 ? vm.addr(agentKey) : deployer;

        address usdcAddr = vm.envOr("USDC_ADDRESS", DEFAULT_FUJI_USDC);

        vm.startBroadcast(deployerKey);

        policy = new SpikePolicy(agentAddr);
        bool ok = IERC20(usdcAddr).transfer(address(policy), INITIAL_FUNDING_USDC);
        require(ok, "USDC funding transfer failed");

        vm.stopBroadcast();

        console2.log("SpikePolicy deployed at:", address(policy));
        console2.log("Owner:", deployer);
        console2.log("Agent:", agentAddr);
        console2.log("USDC balance (6 decimals):", IERC20(usdcAddr).balanceOf(address(policy)));
    }
}
