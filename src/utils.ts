import BigNumber from "bignumber.js";
import varuint from "varuint-bitcoin";

export function satoshisToAmount(val: number) {
  const num = new BigNumber(val);
  return num.dividedBy(100000000).toFixed(8);
}

export function amountToSaothis(val: any) {
  const num = new BigNumber(val);
  return num.multipliedBy(100000000).toNumber();
}

/**
 * Helper function that produces a serialized witness script
 * https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/csv.spec.ts#L477
 */
export function witnessStackToScriptWitness(witness: Buffer[]) {
    let buffer = Buffer.allocUnsafe(0)

    function writeSlice(slice: Buffer) {
        buffer = Buffer.concat([buffer, Buffer.from(slice)])
    }

    function writeVarInt(i: number) {
        const currentLen = buffer.length;
        const varintLen = varuint.encodingLength(i)

        buffer = Buffer.concat([buffer, Buffer.allocUnsafe(varintLen)])
        varuint.encode(i, buffer, currentLen)
    }

    function writeVarSlice(slice: Buffer) {
        writeVarInt(slice.length)
        writeSlice(slice)
    }

    function writeVector(vector: Buffer[]) {
        writeVarInt(vector.length)
        vector.forEach(writeVarSlice)
    }

    writeVector(witness)

    return buffer
}