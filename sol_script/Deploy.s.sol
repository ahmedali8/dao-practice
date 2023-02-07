// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.17;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";

import { GovernorContract } from "contracts/governance_standard/GovernorContract.sol";
import { GovernanceToken } from "contracts/GovernanceToken.sol";
import { TimeLock } from "contracts/governance_standard/TimeLock.sol";
import { Box } from "contracts/Box.sol";
import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";

/// @dev See the Solidity Scripting tutorial: https://book.getfoundry.sh/tutorials/solidity-scripting
contract Deploy is Script {
    uint256 internal constant QUORUM_PERCENTAGE = 4; // Need 4% of voters to pass
    uint256 internal constant MIN_DELAY = 3600; // 1 hour - after a vote passes, you have 1 hour before you can enact
    uint256 internal constant VOTING_PERIOD = 5; // blocks
    uint256 internal constant VOTING_DELAY = 1; // 1 Block - How many blocks till a proposal vote becomes active

    uint256 internal constant NEW_STORE_VALUE = 77;
    string internal constant FUNC_SIG = "store(uint256)";
    string internal constant PROPOSAL_DESCRIPTION = "Proposal #1 77 in the Box!";

    address internal deployer;

    GovernorContract internal governor;
    GovernanceToken internal governanceToken;
    TimeLock internal timeLock;
    Box internal box;

    // use deployerPrivateKey if private key is used
    // uint256 internal deployerPrivateKey;

    function setUp() public virtual {
        // Load private key directly from env
        // deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Load mnemonic directly from env
        string memory mnemonic = vm.envString("MNEMONIC");
        (deployer, ) = deriveRememberKey(mnemonic, 0);
    }

    function run() external {
        // use deployerPrivateKey if private key is used
        vm.startBroadcast(deployer);

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

        vm.stopBroadcast();
    }
}
