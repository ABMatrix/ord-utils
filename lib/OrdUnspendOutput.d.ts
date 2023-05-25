import { UnspentOutput } from "./OrdTransaction";
import { OrdUnit } from "./OrdUnit";
export declare const UTXO_DUST = 546;
export declare class OrdUnspendOutput {
    ordUnits: OrdUnit[];
    utxo: UnspentOutput;
    constructor(utxo: UnspentOutput);
    private split;
    /**
     * Get non-Ord satoshis for spending
     */
    getNonOrdSatoshis(): number;
    /**
     * Get last non-ord satoshis for spending.
     * Only the last one is available
     * @returns
     */
    getLastUnitSatoshis(): number;
    hasOrd(): boolean;
    dump(): void;
}
