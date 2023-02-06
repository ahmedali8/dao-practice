import type { BigNumber } from "@ethersproject/bignumber";

import { toBN } from "./format";

export const ZERO_ADDRESS: string = "0x0000000000000000000000000000000000000000";

export const ZERO_BYTES32: string =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export const MAX_UINT256: BigNumber = toBN(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

export const proposalsFile = "proposals.json";

// Governor Values
export const QUORUM_PERCENTAGE = 4; // Need 4% of voters to pass
export const MIN_DELAY = 3600; // 1 hour - after a vote passes, you have 1 hour before you can enact
// export const VOTING_PERIOD = 45818 // 1 week - how long the vote lasts. This is pretty long even for local tests
export const VOTING_PERIOD = 5; // blocks
export const VOTING_DELAY = 1; // 1 Block - How many blocks till a proposal vote becomes active
export const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

export const NEW_STORE_VALUE = 77;
export const FUNC = "store";
export const PROPOSAL_DESCRIPTION = "Proposal #1 77 in the Box!";
