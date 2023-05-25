"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdUnspendOutput = exports.UTXO_DUST = void 0;
const OrdUnit_1 = require("./OrdUnit");
exports.UTXO_DUST = 546;
class OrdUnspendOutput {
    constructor(utxo) {
        this.utxo = utxo;
        this.split(utxo.satoshis, utxo.ords);
    }
    split(satoshis, ords) {
        const ordUnits = [];
        let leftAmount = satoshis;
        for (let i = 0; i < ords.length; i++) {
            const id = ords[i].id;
            const offset = ords[i].offset;
            let splitAmount = offset - (satoshis - leftAmount);
            const a = leftAmount - splitAmount;
            if (a < exports.UTXO_DUST) {
                splitAmount -= exports.UTXO_DUST;
            }
            if (splitAmount < 0) {
                if (ordUnits.length == 0) {
                    ordUnits.push(new OrdUnit_1.OrdUnit(leftAmount, [
                        {
                            id: id,
                            outputOffset: offset,
                            unitOffset: 0,
                        },
                    ]));
                    leftAmount = 0;
                }
                else {
                    // sequnce?
                    ordUnits[ordUnits.length - 1].ords.push({
                        id,
                        outputOffset: offset,
                        unitOffset: ordUnits[ordUnits.length - 1].satoshis,
                    });
                }
                continue;
            }
            if (leftAmount - splitAmount)
                if (splitAmount > exports.UTXO_DUST) {
                    ordUnits.push(new OrdUnit_1.OrdUnit(splitAmount, []));
                    ordUnits.push(new OrdUnit_1.OrdUnit(exports.UTXO_DUST, [
                        {
                            id,
                            outputOffset: offset,
                            unitOffset: 0,
                        },
                    ]));
                }
                else {
                    ordUnits.push(new OrdUnit_1.OrdUnit(exports.UTXO_DUST + splitAmount, [
                        { id, outputOffset: offset, unitOffset: 0 },
                    ]));
                }
            leftAmount -= splitAmount + exports.UTXO_DUST;
        }
        if (leftAmount > exports.UTXO_DUST) {
            ordUnits.push(new OrdUnit_1.OrdUnit(leftAmount, []));
        }
        else if (leftAmount > 0) {
            if (ordUnits.length > 0) {
                ordUnits[ordUnits.length - 1].satoshis += leftAmount;
            }
            else {
                ordUnits.push(new OrdUnit_1.OrdUnit(leftAmount, []));
            }
        }
        this.ordUnits = ordUnits;
    }
    /**
     * Get non-Ord satoshis for spending
     */
    getNonOrdSatoshis() {
        return this.ordUnits
            .filter((v) => v.ords.length == 0)
            .reduce((pre, cur) => pre + cur.satoshis, 0);
    }
    /**
     * Get last non-ord satoshis for spending.
     * Only the last one is available
     * @returns
     */
    getLastUnitSatoshis() {
        const last = this.ordUnits[this.ordUnits.length - 1];
        if (last.ords.length == 0) {
            return last.satoshis;
        }
        return 0;
    }
    hasOrd() {
        return this.utxo.ords.length > 0;
    }
    dump() {
        this.ordUnits.forEach((v) => {
            console.log("satoshis:", v.satoshis, "ords:", v.ords);
        });
    }
}
exports.OrdUnspendOutput = OrdUnspendOutput;
