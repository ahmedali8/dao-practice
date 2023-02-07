import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { increase } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time";
import { ethers, network } from "hardhat";

import { DEVELOPMENT_CHAINS } from "../config/networks";
import { FUNC, MIN_DELAY, NEW_STORE_VALUE, PROPOSAL_DESCRIPTION } from "../utils/constants";

export async function queueAndExecute() {
  const args = [NEW_STORE_VALUE];
  const functionToCall = FUNC;
  const box = await ethers.getContract("Box");
  const encodedFunctionCall = box.interface.encodeFunctionData(functionToCall, args);
  const descriptionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(PROPOSAL_DESCRIPTION));
  // could also use ethers.utils.id(PROPOSAL_DESCRIPTION)

  const governor = await ethers.getContract("GovernorContract");

  console.log("Queueing...");

  const queueTx = await governor.queue([box.address], [0], [encodedFunctionCall], descriptionHash);
  await queueTx.wait(1);

  if (DEVELOPMENT_CHAINS.includes(network.name)) {
    await increase(MIN_DELAY + 1);
    await mine(1);
  }

  console.log("Executing...");

  // this will fail on a testnet because you need to wait for the MIN_DELAY!
  const executeTx = await governor.execute(
    [box.address],
    [0],
    [encodedFunctionCall],
    descriptionHash
  );
  await executeTx.wait(1);
  const boxNewValue = await box.retrieve();
  console.log(boxNewValue.toString());
}

queueAndExecute()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
