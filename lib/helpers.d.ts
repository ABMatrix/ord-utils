import { UnspentOutput } from "./OrdTransaction";
/**
 * Get non-ord balance for spending
 * @param utxos
 * @returns
 */
export declare function getNonOrdBalance(utxos: UnspentOutput[]): number;
