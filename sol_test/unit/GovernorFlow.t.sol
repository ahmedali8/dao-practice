// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0 <0.9.0;

import { console2 } from "forge-std/console2.sol";
import { BaseTest } from "./BaseTest.t.sol";
import { GovernorContract } from "contracts/governance_standard/GovernorContract.sol";
import { GovernanceToken } from "contracts/GovernanceToken.sol";
import { TimeLock } from "contracts/governance_standard/TimeLock.sol";
import { Box } from "contracts/Box.sol";
import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { Vm } from "forge-std/Vm.sol";
import { IGovernor } from "@openzeppelin/contracts/governance/IGovernor.sol";

contract GovernorFlowTest is BaseTest {
    uint256 internal constant QUORUM_PERCENTAGE = 4; // Need 4% of voters to pass
    uint256 internal constant MIN_DELAY = 3600; // 1 hour - after a vote passes, you have 1 hour before you can enact
    uint256 internal constant VOTING_PERIOD = 5; // blocks
    uint256 internal constant VOTING_DELAY = 1; // 1 Block - How many blocks till a proposal vote becomes active

    uint256 internal constant NEW_STORE_VALUE = 77;
    string internal constant FUNC_SIG = "store(uint256)";
    string internal constant PROPOSAL_DESCRIPTION = "Proposal #1 77 in the Box!";

    uint8 internal voteWay = 1;
    string internal reason = "I lika do da cha cha";

    GovernorContract internal governor;
    GovernanceToken internal governanceToken;
    TimeLock internal timeLock;
    Box internal box;

    /// SETUP FUNCTION ///

    function setUp() public virtual override {
        super.setUp();

        /// 01-deploy-governor-token ///
        console2.log("----------------------------------------------------");
        console2.log("Deploying GovernanceToken and waiting for confirmations...");

        governanceToken = new GovernanceToken();

        console2.log("GovernanceToken at", address(governanceToken));

        console2.log("Delegating to", deployer);

        governanceToken.delegate(deployer);
        console2.log("Checkpoints: ", governanceToken.numCheckpoints(deployer));

        console2.log("Delegated!");

        /// 02-deploy-time-lock ///
        console2.log("----------------------------------------------------");
        console2.log("Deploying TimeLock and waiting for confirmations...");

        uint256 minDelay = MIN_DELAY;
        address[] memory proposers;
        address[] memory executors;
        address admin = deployer;
        timeLock = new TimeLock(minDelay, proposers, executors, admin);

        console2.log("GovernanceToken at", address(timeLock));

        /// 03-deploy-governor-contract ///
        console2.log("----------------------------------------------------");
        console2.log("Deploying GovernorContract and waiting for confirmations...");

        ERC20Votes token = governanceToken;
        TimelockController timelock = timeLock;
        uint256 quorumPercentage = QUORUM_PERCENTAGE;
        uint256 votingPeriod = VOTING_PERIOD;
        uint256 votingDelay = VOTING_DELAY;
        governor = new GovernorContract(
            token,
            timelock,
            quorumPercentage,
            votingPeriod,
            votingDelay
        );

        console2.log("GovernorContract at", address(governor));

        /// 04-setup-governance-contracts ///
        console2.log("----------------------------------------------------");
        console2.log("Setting up contracts for roles...");

        // would be great to use multicall here...
        bytes32 proposerRole = timeLock.PROPOSER_ROLE();
        bytes32 executorRole = timeLock.EXECUTOR_ROLE();
        bytes32 adminRole = timeLock.TIMELOCK_ADMIN_ROLE();

        timeLock.grantRole(proposerRole, address(governor));
        timeLock.grantRole(executorRole, address(0));
        timeLock.grantRole(adminRole, deployer);
        // Guess what? Now, anything the timelock wants to do has to go through the governance process!

        /// 05-deploy-box ///
        console2.log("----------------------------------------------------");
        console2.log("Deploying Box and waiting for confirmations...");

        box = new Box();

        console2.log("Box at", address(box));

        box.transferOwnership(address(timeLock));
    }

    function test_Revert_WhenChangedThroughOtherThanGovernance() external {
        vm.expectRevert("Ownable: caller is not the owner");
        box.store(55);
    }

    function test_ProposesVotesWaitsQueuesAndThenExecutes() external {
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);

        // propose
        bytes memory encodedFunctionCall = abi.encodeWithSignature(FUNC_SIG, NEW_STORE_VALUE);

        targets[0] = address(box);
        values[0] = 0;
        calldatas[0] = encodedFunctionCall;
        string memory description = PROPOSAL_DESCRIPTION;

        vm.recordLogs();
        governor.propose(targets, values, calldatas, description);

        uint256 boxStartingValue = box.retrieve();
        console2.log("Box starting value is: ", boxStartingValue);

        Vm.Log[] memory entries = vm.getRecordedLogs();

        assertEq(entries.length, 1);
        // event ProposalCreated(
        //     uint256 proposalId,
        //     address proposer,
        //     address[] targets,
        //     uint256[] values,
        //     string[] signatures,
        //     bytes[] calldatas,
        //     uint256 startBlock,
        //     uint256 endBlock,
        //     string description
        // );
        assertEq(
            entries[0].topics[0],
            keccak256(
                "ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)"
            )
        );

        GovernorContract.ProposalState proposalState;
        uint256 proposalId = abi.decode(entries[0].data, (uint256));

        proposalState = governor.state(proposalId);
        console2.log("Current Proposal State: ", uint256(proposalState));
        assertEq(uint256(proposalState), 0);
        assert(proposalState == IGovernor.ProposalState.Pending);

        vm.roll(block.number + VOTING_DELAY + 1);

        // vote
        governor.castVoteWithReason(proposalId, voteWay, reason);

        proposalState = governor.state(proposalId);
        console2.log("Current Proposal State: ", uint256(proposalState));
        assertEq(uint256(proposalState), 1);
        assert(proposalState == IGovernor.ProposalState.Active);

        vm.roll(block.number + VOTING_PERIOD + 1);

        // queue & execute
        bytes32 descriptionHash = keccak256(bytes(PROPOSAL_DESCRIPTION));

        targets[0] = address(box);
        values[0] = 0;
        calldatas[0] = encodedFunctionCall;

        governor.queue(targets, values, calldatas, descriptionHash);

        vm.warp(block.timestamp + MIN_DELAY + 1);
        vm.roll(block.number + 1);

        proposalState = governor.state(proposalId);
        console2.log("Current Proposal State: ", uint256(proposalState));
        assertEq(uint256(proposalState), 5);
        assert(proposalState == IGovernor.ProposalState.Queued);

        console2.log("Executing...");

        targets[0] = address(box);
        values[0] = 0;
        calldatas[0] = encodedFunctionCall;
        governor.execute(targets, values, calldatas, descriptionHash);

        uint256 boxEndingValue = box.retrieve();
        console2.log("Box ending value THROUGH GOVERNANCE IS: ", boxEndingValue);
    }
}
