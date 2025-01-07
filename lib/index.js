"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateMaxBtc = exports.createSendMaxBTC = exports.createSendMultiBTC = exports.createSendMultiOrds = exports.createSendBTC = void 0;
const OrdTransaction_1 = require("./OrdTransaction");
const OrdUnspendOutput_1 = require("./OrdUnspendOutput");
const utils_1 = require("./utils");
__exportStar(require("./utils"), exports);
function createSendBTC({ utxos, toAddress, toAmount, wallet, network, changeAddress, receiverToPayFee, feeRate, dump, data, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const tx = new OrdTransaction_1.OrdTransaction(wallet, network, feeRate);
        tx.setChangeAddress(changeAddress);
        const nonOrdUtxos = [];
        const ordUtxos = [];
        utxos.forEach((v) => {
            if (v.ords.length > 0) {
                ordUtxos.push(v);
            }
            else {
                nonOrdUtxos.push(v);
            }
        });
        tx.addOutput(toAddress, toAmount);
        const outputAmount = tx.getTotalOutput();
        let tmpSum = tx.getTotalInput();
        for (let i = 0; i < nonOrdUtxos.length; i++) {
            const nonOrdUtxo = nonOrdUtxos[i];
            if (tmpSum < outputAmount) {
                tx.addInput(nonOrdUtxo);
                tmpSum += nonOrdUtxo.satoshis;
                continue;
            }
            const fee = yield tx.calNetworkFee();
            if (tmpSum < outputAmount + fee) {
                tx.addInput(nonOrdUtxo);
                tmpSum += nonOrdUtxo.satoshis;
            }
            else {
                break;
            }
        }
        if (data)
            tx.addOpReturnOutput(data);
        if (nonOrdUtxos.length === 0) {
            throw new Error("Balance not enough");
        }
        if (receiverToPayFee) {
            const unspent = tx.getUnspent();
            if (unspent >= OrdUnspendOutput_1.UTXO_DUST) {
                tx.addChangeOutput(unspent);
            }
            const networkFee = yield tx.calNetworkFee();
            // @ts-ignore
            const output = tx.outputs.find((v) => v.address === toAddress);
            if (output.value < networkFee) {
                throw new Error(`Balance not enough. Need ${(0, utils_1.satoshisToAmount)(networkFee)} BTC as network fee`);
            }
            output.value -= networkFee;
        }
        else {
            const unspent = tx.getUnspent();
            if (unspent === 0) {
                throw new Error("Balance not enough to pay network fee.");
            }
            // add dummy output
            tx.addChangeOutput(1);
            const networkFee = yield tx.calNetworkFee();
            if (unspent < networkFee) {
                throw new Error(`Balance not enough. Need ${(0, utils_1.satoshisToAmount)(networkFee)} BTC as network fee, but only ${(0, utils_1.satoshisToAmount)(unspent)} BTC.`);
            }
            const leftAmount = unspent - networkFee;
            if (leftAmount >= OrdUnspendOutput_1.UTXO_DUST) {
                // change dummy output to true output
                tx.getChangeOutput().value = leftAmount;
            }
            else {
                // remove dummy output
                tx.removeChangeOutput();
            }
        }
        const psbt = yield tx.createSignedPsbt();
        if (dump) {
            tx.dumpTx(psbt);
        }
        return psbt;
    });
}
exports.createSendBTC = createSendBTC;
function createSendMultiOrds({ utxos, toAddress, toOrdIds, receivers, wallet, network, changeAddress, feeRate, dump, data, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const tx = new OrdTransaction_1.OrdTransaction(wallet, network, feeRate);
        tx.setChangeAddress(changeAddress);
        const nonOrdUtxos = [];
        const ordUtxos = [];
        utxos.forEach((v) => {
            if (v.ords.length > 0) {
                ordUtxos.push(v);
            }
            else {
                nonOrdUtxos.push(v);
            }
        });
        // find NFT
        let foundedCount = 0;
        for (let i = 0; i < ordUtxos.length; i++) {
            const ordUtxo = ordUtxos[i];
            if (ordUtxo.ords.find((v) => toOrdIds.includes(v.id))) {
                if (ordUtxo.ords.length > 1) {
                    throw new Error("Multiple inscriptions in one UTXO! Please split them first.");
                }
                tx.addInput(ordUtxo);
                tx.addOutput(toAddress, OrdUnspendOutput_1.UTXO_DUST);
                foundedCount++;
            }
        }
        receivers.forEach((v) => {
            tx.addOutput(v.address, v.amount);
        });
        if (Array.isArray(data)) {
            data.forEach(a => tx.addOpReturnOutput(a));
        }
        else {
            if (data)
                tx.addOpReturnOutput(data);
        }
        if (foundedCount != toOrdIds.length) {
            throw new Error("inscription not found.");
        }
        // Do not format NFT
        // tx.outputs[0].value = outputValue;
        // select non ord utxo
        const outputAmount = tx.getTotalOutput();
        let tmpSum = tx.getTotalInput();
        for (let i = 0; i < nonOrdUtxos.length; i++) {
            const nonOrdUtxo = nonOrdUtxos[i];
            if (tmpSum < outputAmount) {
                tx.addInput(nonOrdUtxo);
                tmpSum += nonOrdUtxo.satoshis;
                continue;
            }
            const fee = yield tx.calNetworkFee();
            if (tmpSum < outputAmount + fee) {
                tx.addInput(nonOrdUtxo);
                tmpSum += nonOrdUtxo.satoshis;
            }
            else {
                break;
            }
        }
        const unspent = tx.getUnspent();
        if (unspent == 0) {
            throw new Error("Balance not enough to pay network fee.");
        }
        // add dummy output
        tx.addChangeOutput(1);
        const networkFee = yield tx.calNetworkFee();
        if (unspent < networkFee) {
            throw new Error(`Balance not enough. Need ${(0, utils_1.satoshisToAmount)(networkFee)} BTC as network fee, but only ${(0, utils_1.satoshisToAmount)(unspent)} BTC.`);
        }
        const leftAmount = unspent - networkFee;
        if (leftAmount >= OrdUnspendOutput_1.UTXO_DUST) {
            // change dummy output to true output
            tx.getChangeOutput().value = leftAmount;
        }
        else {
            // remove dummy output
            tx.removeChangeOutput();
        }
        const psbt = yield tx.createSignedPsbt();
        if (dump) {
            tx.dumpTx(psbt);
        }
        return psbt;
    });
}
exports.createSendMultiOrds = createSendMultiOrds;
function createSendMultiBTC({ utxos, receivers, wallet, network, changeAddress, feeRate, dump, data, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const tx = new OrdTransaction_1.OrdTransaction(wallet, network, feeRate);
        tx.setChangeAddress(changeAddress);
        const nonOrdUtxos = [];
        const ordUtxos = [];
        utxos.forEach((v) => {
            if (v.ords.length > 0) {
                ordUtxos.push(v);
            }
            else {
                nonOrdUtxos.push(v);
            }
        });
        receivers.forEach((v) => {
            tx.addOutput(v.address, v.amount);
        });
        if (data)
            tx.addOpReturnOutput(data);
        const outputAmount = tx.getTotalOutput();
        let tmpSum = tx.getTotalInput();
        for (let i = 0; i < nonOrdUtxos.length; i++) {
            const nonOrdUtxo = nonOrdUtxos[i];
            if (tmpSum < outputAmount) {
                tx.addInput(nonOrdUtxo);
                tmpSum += nonOrdUtxo.satoshis;
                continue;
            }
            const fee = yield tx.calNetworkFee();
            if (tmpSum < outputAmount + fee) {
                tx.addInput(nonOrdUtxo);
                tmpSum += nonOrdUtxo.satoshis;
            }
            else {
                break;
            }
        }
        if (nonOrdUtxos.length === 0) {
            throw new Error("Balance not enough");
        }
        const unspent = tx.getUnspent();
        if (unspent === 0) {
            throw new Error("Balance not enough to pay network fee.");
        }
        // add dummy output
        tx.addChangeOutput(1);
        const networkFee = yield tx.calNetworkFee();
        if (unspent < networkFee) {
            throw new Error(`Balance not enough. Need ${(0, utils_1.satoshisToAmount)(networkFee)} BTC as network fee, but only ${(0, utils_1.satoshisToAmount)(unspent)} BTC.`);
        }
        const leftAmount = unspent - networkFee;
        if (leftAmount >= OrdUnspendOutput_1.UTXO_DUST) {
            // change dummy output to true output
            tx.getChangeOutput().value = leftAmount;
        }
        else {
            // remove dummy output
            tx.removeChangeOutput();
        }
        const psbt = yield tx.createSignedPsbt();
        console.log({ psbt });
        if (dump) {
            tx.dumpTx(psbt);
        }
        return psbt;
    });
}
exports.createSendMultiBTC = createSendMultiBTC;
function createSendMaxBTC({ utxos, receivers, wallet, network, changeAddress, feeRate, dump, data, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const tx = new OrdTransaction_1.OrdTransaction(wallet, network, feeRate);
        tx.setChangeAddress(changeAddress);
        const to = receivers.find((v) => v.amount === undefined).address;
        if (!to) {
            throw new Error("No receiver found, please provide one receiver with undefined amount");
        }
        const nonOrdUtxos = [];
        const ordUtxos = [];
        utxos.forEach((v) => {
            if (v.ords.length > 0) {
                ordUtxos.push(v);
            }
            else {
                nonOrdUtxos.push(v);
            }
        });
        receivers.forEach((v) => {
            if (v.amount) {
                tx.addOutput(v.address, v.amount);
            }
            else {
                tx.addOutput(v.address, 0);
            }
        });
        if (data)
            tx.addOpReturnOutput(data);
        const outputAmount = tx.getTotalOutput();
        if (nonOrdUtxos.length === 0) {
            throw new Error("Balance not enough");
        }
        for (let i = 0; i < nonOrdUtxos.length; i++) {
            const nonOrdUtxo = nonOrdUtxos[i];
            tx.addInput(nonOrdUtxo);
        }
        const tmpSum = tx.getTotalInput();
        const fee = yield tx.calNetworkFee();
        const left = tmpSum - outputAmount - fee;
        if (left < OrdUnspendOutput_1.UTXO_DUST) {
            throw new Error(`Balance not enough. Need ${(0, utils_1.satoshisToAmount)(outputAmount + fee)} BTC as network fee, but only ${(0, utils_1.satoshisToAmount)(tmpSum)} BTC.`);
        }
        tx.outputs.find(o => o.value === 0).value = left;
        // const unspent = tx.getUnspent();
        // if (unspent === 0) {
        //   throw new Error("Balance not enough to pay network fee.");
        // }
        const psbt = yield tx.createSignedPsbt();
        if (dump) {
            tx.dumpTx(psbt);
        }
        return psbt;
    });
}
exports.createSendMaxBTC = createSendMaxBTC;
function calculateMaxBtc({ utxos, receivers, network, changeAddress, feeRate, data, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const tx = new OrdTransaction_1.OrdTransaction(undefined, network, feeRate);
        tx.setChangeAddress(changeAddress);
        const to = receivers.find((v) => v.amount === undefined).address;
        if (!to) {
            throw new Error("No receiver found, please provide one receiver with undefined amount");
        }
        const nonOrdUtxos = [];
        const ordUtxos = [];
        utxos.forEach((v) => {
            if (v.ords.length > 0) {
                ordUtxos.push(v);
            }
            else {
                nonOrdUtxos.push(v);
            }
        });
        receivers.forEach((v) => {
            if (v.amount) {
                tx.addOutput(v.address, v.amount);
            }
            else {
                tx.addOutput(v.address, 0);
            }
        });
        if (data)
            tx.addOpReturnOutput(data);
        const outputAmount = tx.getTotalOutput();
        if (nonOrdUtxos.length === 0) {
            throw new Error("Balance not enough");
        }
        for (let i = 0; i < nonOrdUtxos.length; i++) {
            const nonOrdUtxo = nonOrdUtxos[i];
            tx.addInput(nonOrdUtxo);
        }
        const tmpSum = tx.getTotalInput();
        const fee = yield tx.calNetworkFee();
        const left = tmpSum - outputAmount - fee;
        if (left < OrdUnspendOutput_1.UTXO_DUST) {
            throw new Error(`At least ${(0, utils_1.satoshisToAmount)(outputAmount + fee)} BTC.`);
        }
        return fee;
    });
}
exports.calculateMaxBtc = calculateMaxBtc;
