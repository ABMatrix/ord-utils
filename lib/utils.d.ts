/// <reference types="node" />
/// <reference types="node" />
export declare function satoshisToAmount(val: number): string;
export declare function amountToSatoshis(val: any): number;
/**
 * Helper function that produces a serialized witness script
 * https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/csv.spec.ts#L477
 */
export declare function witnessStackToScriptWitness(witness: Buffer[]): Buffer;
