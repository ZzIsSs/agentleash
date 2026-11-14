// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AgentPolicy, IFiatToken} from "./AgentPolicy.sol";

/// @title AgentPolicyFactory
/// @author Nguyen (AgentLeash Technical Lead)
/// @notice Factory contract allowing any user to deploy their own non-custodial AgentPolicy on Avalanche Fuji.
contract AgentPolicyFactory {
    IFiatToken public immutable usdc;

    address[] public allPolicies;
    mapping(address => address[]) public policiesByOwner;

    event PolicyCreated(address indexed owner, address indexed policy, address indexed agent);

    error ZeroAddress();

    constructor(address _usdc) {
        if (_usdc == address(0)) revert ZeroAddress();
        usdc = IFiatToken(_usdc);
    }

    /// @notice Deploy a new AgentPolicy where msg.sender is the sole owner
    function createPolicy(
        address agent,
        uint256 perTxCap,
        uint256 dailyCap,
        uint256 sandboxPerTxCap,
        uint256 sandboxDailyCap,
        uint256 period
    ) external returns (address policyAddress) {
        if (agent == address(0)) revert ZeroAddress();

        AgentPolicy policy = new AgentPolicy(
            msg.sender,
            agent,
            address(usdc),
            perTxCap,
            dailyCap,
            sandboxPerTxCap,
            sandboxDailyCap,
            period
        );

        policyAddress = address(policy);
        allPolicies.push(policyAddress);
        policiesByOwner[msg.sender].push(policyAddress);

        emit PolicyCreated(msg.sender, policyAddress, agent);
    }

    /// @notice Total number of policies deployed via this factory
    function allPoliciesLength() external view returns (uint256) {
        return allPolicies.length;
    }

    /// @notice Get list of policies deployed by an owner
    function getPoliciesByOwner(address owner) external view returns (address[] memory) {
        return policiesByOwner[owner];
    }
}
