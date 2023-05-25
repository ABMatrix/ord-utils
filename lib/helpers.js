"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNonOrdBalance = void 0;
const OrdUnspendOutput_1 = require("./OrdUnspendOutput");
/**
 * Get non-ord balance for spending
 * @param utxos
 * @returns
 */
function getNonOrdBalance(utxos) {
    return utxos
        .map((v) => new OrdUnspendOutput_1.OrdUnspendOutput(v))
        .reduce((pre, cur) => pre + cur.getNonOrdSatoshis(), 0);
}
exports.getNonOrdBalance = getNonOrdBalance;
