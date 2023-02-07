import { mine } from "@nomicfoundation/hardhat-network-helpers";
import * as fs from "fs-extra";
import { ethers, network } from "hardhat";
import { join } from "path";

import { DEVELOPMENT_CHAINS } from "../config/networks";
import { VOTING_PERIOD, proposalsFile } from "../utils/constants";

const index = 0;

async function main(proposalIndex: number) {
  const proposals = JSON.parse(fs.readFileSync(join(__dirname, proposalsFile), "utf8"));

  // You could swap this out for the ID you want to use too
  const proposalId = proposals[network.config.chainId!][proposalIndex];

  // 0 = Against, 1 = For, 2 = Abstain for this example
  const voteWay = 1;

  const reason = "I lika do da cha cha";
  await vote(proposalId, voteWay, reason);
}

// 0 = Against, 1 = For, 2 = Abstain for this example
export async function vote(proposalId: string, voteWay: number, reason: string) {
  console.log("Voting...");

  const governor = await ethers.getContract("GovernorContract");
  const voteTx = await governor.castVoteWithReason(proposalId, voteWay, reason);
  const voteTxReceipt = await voteTx.wait(1);
  console.log(voteTxReceipt.events[0].args.reason);

  const proposalState = await governor.state(proposalId);
  console.log(`Current Proposal State: ${proposalState}`);

  if (DEVELOPMENT_CHAINS.includes(network.name)) {
    await mine(VOTING_PERIOD + 1);
  }
}

main(index)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
