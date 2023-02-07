import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { DEVELOPMENT_CHAINS } from "../config/networks";
import { MIN_DELAY } from "../utils/constants";
import { verifyContract } from "../utils/verify";

const deployTimeLock: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("----------------------------------------------------");
  log("Deploying TimeLock and waiting for confirmations...");

  const timeLock = await deploy("TimeLock", {
    from: deployer,
    args: [MIN_DELAY, [], [], deployer],
    log: true,
    // we need to wait if on a live network so we can verify properly
    waitConfirmations: DEVELOPMENT_CHAINS.includes(network.name) ? 1 : 6,
  });

  log(`TimeLock at ${timeLock.address}`);

  if (!DEVELOPMENT_CHAINS.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    await verifyContract({
      contractAddress: timeLock.address,
      args: [MIN_DELAY, [], [], deployer],
    });
  }
};

export default deployTimeLock;
deployTimeLock.tags = ["all", "timelock"];
