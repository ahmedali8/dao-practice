import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { increase } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time";
import { assert, expect } from "chai";
import { deployments, ethers } from "hardhat";

import type { Box, GovernanceToken, GovernorContract, TimeLock } from "../types";
import {
  FUNC,
  MIN_DELAY,
  NEW_STORE_VALUE,
  PROPOSAL_DESCRIPTION,
  VOTING_DELAY,
  VOTING_PERIOD,
} from "../utils/constants";

describe("Governor Flow", function () {
  let governor: GovernorContract;
  let governanceToken: GovernanceToken;
  let timeLock: TimeLock;
  let box: Box;

  const voteWay = 1; // for
  const reason = "I lika do da cha cha";

  beforeEach(async function () {
    await deployments.fixture(["all"]);

    governor = await ethers.getContract("GovernorContract");
    timeLock = await ethers.getContract("TimeLock");
    governanceToken = await ethers.getContract("GovernanceToken");
    box = await ethers.getContract("Box");
  });

  it("can only be changed through governance", async function () {
    await expect(box.store(55)).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("proposes, votes, waits, queues, and then executes", async function () {
    // propose
    const encodedFunctionCall = box.interface.encodeFunctionData(FUNC, [NEW_STORE_VALUE]);
    const proposeTx = await governor.propose(
      [box.address],
      [0],
      [encodedFunctionCall],
      PROPOSAL_DESCRIPTION
    );
    const boxStartingValue = await box.retrieve();
    console.log(`Box starting value is: ${boxStartingValue.toString()}`);
    const proposeReceipt = await proposeTx.wait(1);
    const proposalId = proposeReceipt.events![0].args!.proposalId;
    let proposalState = await governor.state(proposalId);
    console.log(`Current Proposal State: ${proposalState}`);

    await mine(VOTING_DELAY + 1);
    // vote
    const voteTx = await governor.castVoteWithReason(proposalId, voteWay, reason);
    await voteTx.wait(1);
    proposalState = await governor.state(proposalId);
    assert.equal(proposalState.toString(), "1");
    console.log(`Current Proposal State: ${proposalState}`);
    await mine(VOTING_PERIOD + 1);

    // queue & execute
    // const descriptionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(PROPOSAL_DESCRIPTION))
    const descriptionHash = ethers.utils.id(PROPOSAL_DESCRIPTION);
    const queueTx = await governor.queue(
      [box.address],
      [0],
      [encodedFunctionCall],
      descriptionHash
    );
    await queueTx.wait(1);
    await increase(MIN_DELAY + 1);
    await mine(1);

    proposalState = await governor.state(proposalId);
    console.log(`Current Proposal State: ${proposalState}`);

    console.log("Executing...");
    console.log;
    const exTx = await governor.execute([box.address], [0], [encodedFunctionCall], descriptionHash);
    await exTx.wait(1);
    const boxEndingValue = await box.retrieve();
    console.log(`Box ending value THROUGH GOVERNANCE IS: ${boxEndingValue.toString()}`);
  });
});
