import type { DeployFunction } from "hardhat-deploy/types";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

import { DEVELOPMENT_CHAINS } from "../config/networks";
import { QUORUM_PERCENTAGE, VOTING_DELAY, VOTING_PERIOD } from "../utils/constants";
import { verifyContract } from "../utils/verify";

const deployGovernorContract: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre;
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const governanceToken = await get("GovernanceToken");
  const timeLock = await get("TimeLock");

  log("----------------------------------------------------");
  log("Deploying GovernorContract and waiting for confirmations...");

  const governorContract = await deploy("GovernorContract", {
    from: deployer,
    args: [
      governanceToken.address,
      timeLock.address,
      QUORUM_PERCENTAGE,
      VOTING_PERIOD,
      VOTING_DELAY,
    ],
    log: true,
    // we need to wait if on a live network so we can verify properly
    waitConfirmations: DEVELOPMENT_CHAINS.includes(network.name) ? 1 : 6,
  });

  log(`GovernorContract at ${governorContract.address}`);

  if (!DEVELOPMENT_CHAINS.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    await verifyContract({
      contractAddress: governorContract.address,
      args: [
        governanceToken.address,
        timeLock.address,
        QUORUM_PERCENTAGE,
        VOTING_PERIOD,
        VOTING_DELAY,
      ],
    });
  }
};

export default deployGovernorContract;
deployGovernorContract.tags = ["all", "governor"];
