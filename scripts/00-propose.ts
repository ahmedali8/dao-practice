import { mine } from "@nomicfoundation/hardhat-network-helpers";
import * as fs from "fs-extra";
import { ethers, network } from "hardhat";
import { join } from "path";

import { DEVELOPMENT_CHAINS } from "../config/networks";
import {
  FUNC,
  NEW_STORE_VALUE,
  PROPOSAL_DESCRIPTION,
  VOTING_DELAY,
  proposalsFile,
} from "../utils/constants";

export async function propose(args: number[], functionToCall: string, proposalDescription: string) {
  const governor = await ethers.getContract("GovernorContract");
  const box = await ethers.getContract("Box");
  const encodedFunctionCall = box.interface.encodeFunctionData(functionToCall, args);
  console.log(`Proposing ${functionToCall} on ${box.address} with ${args}`);
  console.log(`Proposal Description:\n  ${proposalDescription}`);
  const proposeTx = await governor.propose(
    [box.address],
    [0],
    [encodedFunctionCall],
    proposalDescription
  );

  // If working on a development chain, we will push forward till we get to the voting period.
  if (DEVELOPMENT_CHAINS.includes(network.name)) {
    await mine(VOTING_DELAY + 1);
  }

  const proposeReceipt = await proposeTx.wait(1);
  const proposalId = proposeReceipt.events[0].args.proposalId;
  console.log(`Proposed with proposal ID:\n  ${proposalId}`);

  const proposalState = await governor.state(proposalId);
  const proposalSnapShot = await governor.proposalSnapshot(proposalId);
  const proposalDeadline = await governor.proposalDeadline(proposalId);

  // save the proposalId
  const proposals = JSON.parse(fs.readFileSync(join(__dirname, proposalsFile), "utf8"));
  proposals[network.config.chainId!.toString()].push(proposalId.toString());
  fs.writeFileSync(join(__dirname, proposalsFile), JSON.stringify(proposals));

  // The state of the proposal. 1 is not passed. 0 is passed.
  console.log(`Current Proposal State: ${proposalState}`);
  // What block # the proposal was snapshot
  console.log(`Current Proposal Snapshot: ${proposalSnapShot}`);
  // The block number the proposal voting expires
  console.log(`Current Proposal Deadline: ${proposalDeadline}`);
}

propose([NEW_STORE_VALUE], FUNC, PROPOSAL_DESCRIPTION)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
