import { ethers } from "hardhat";
import type { DeployFunction } from "hardhat-deploy/types";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

import { DEVELOPMENT_CHAINS } from "../config/networks";
import { verifyContract } from "../utils/verify";

const deployGovernanceToken: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("----------------------------------------------------");
  log("Deploying GovernanceToken and waiting for confirmations...");

  const governanceToken = await deploy("GovernanceToken", {
    from: deployer,
    args: [],
    log: true,
    // we need to wait if on a live network so we can verify properly
    waitConfirmations: DEVELOPMENT_CHAINS.includes(network.name) ? 1 : 6,
  });

  log(`GovernanceToken at ${governanceToken.address}`);

  if (!DEVELOPMENT_CHAINS.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    await verifyContract({ contractAddress: governanceToken.address, args: [] });
  }

  log(`Delegating to ${deployer}`);

  await delegate(governanceToken.address, deployer);

  log("Delegated!");
};

const delegate = async (governanceTokenAddress: string, delegatedAccount: string) => {
  const governanceToken = await ethers.getContractAt("GovernanceToken", governanceTokenAddress);
  const transactionResponse = await governanceToken.delegate(delegatedAccount);
  await transactionResponse.wait(1);
  console.log(`Checkpoints: ${await governanceToken.numCheckpoints(delegatedAccount)}`);
};

export default deployGovernanceToken;
deployGovernanceToken.tags = ["all", "governor"];
