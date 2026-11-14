// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SpikePolicy} from "../src/SpikePolicy.sol";

contract SpikePolicyTest is Test {
    SpikePolicy internal policy;
    address internal owner = address(this);
    address internal agent = address(0xA11CE);
    address internal attacker = address(0xBAD);

    function setUp() public {
        policy = new SpikePolicy(agent);
    }

    function testApproveByOwnerAndAgent() public {
        bytes32 d1 = keccak256("digest-1");
        bytes32 d2 = keccak256("digest-2");

        assertEq(policy.isValidSignature(d1, ""), bytes4(0xffffffff));

        policy.approve(d1);
        assertEq(policy.isValidSignature(d1, ""), bytes4(0x1626ba7e));

        vm.prank(agent);
        policy.approve(d2);
        assertEq(policy.isValidSignature(d2, hex"deadbeef"), bytes4(0x1626ba7e));
    }

    function testApproveRevertForAttacker() public {
        bytes32 d1 = keccak256("digest-1");
        vm.prank(attacker);
        vm.expectRevert(SpikePolicy.Unauthorized.selector);
        policy.approve(d1);
    }
}
