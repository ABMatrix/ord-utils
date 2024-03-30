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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inscribeWithOneStep = exports.inscribe = exports.createSendMultiBTC = exports.createSendMultiOrds = exports.createSendOrd = exports.createSendBTC = exports.initWasm = void 0;
const lib_1 = require("../packages/tiny-secp256k1/lib");
const OrdTransaction_1 = require("./OrdTransaction");
const OrdUnspendOutput_1 = require("./OrdUnspendOutput");
const utils_1 = require("./utils");
const bitcoin = __importStar(require("bitcoinjs-lib-mpc"));
const bip32_1 = __importDefault(require("bip32"));
__exportStar(require("./utils"), exports);
const rng = require("randombytes");
var lib_2 = require("../packages/tiny-secp256k1/lib");
Object.defineProperty(exports, "initWasm", { enumerable: true, get: function () { return lib_2.initWasm; } });
function createSendBTC({ utxos, toAddress, toAmount, wallet, network, changeAddress, receiverToPayFee, feeRate, pubkey, dump, data, txInfo, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const tx = new OrdTransaction_1.OrdTransaction(wallet, network, pubkey, feeRate);
        yield tx.initBitcoin();
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
        const psbt = yield tx.createSignedPsbt(txInfo);
        if (dump) {
            tx.dumpTx(psbt);
        }
        return psbt;
    });
}
exports.createSendBTC = createSendBTC;
function createSendOrd({ utxos, toAddress, toOrdId, wallet, network, changeAddress, pubkey, feeRate, outputValue, dump, data, txInfo, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const tx = new OrdTransaction_1.OrdTransaction(wallet, network, pubkey, feeRate);
        yield tx.initBitcoin();
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
        let found = false;
        for (let i = 0; i < ordUtxos.length; i++) {
            const ordUtxo = ordUtxos[i];
            if (ordUtxo.ords.find((v) => v.id == toOrdId)) {
                if (ordUtxo.ords.length > 1) {
                    throw new Error("Multiple inscriptions! Please split them first.");
                }
                tx.addInput(ordUtxo);
                tx.addOutput(toAddress, OrdUnspendOutput_1.UTXO_DUST);
                found = true;
                break;
            }
        }
        if (data)
            tx.addOpReturnOutput(data);
        if (!found) {
            throw new Error("inscription not found.");
        }
        // format NFT
        tx.outputs[0].value = outputValue;
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
        if (data) {
            try {
            }
            catch (error) {
                if (error instanceof Error && this.developMode) {
                    console.log(error.message);
                }
                throw new Error("Invalid transaction data, it should be a hex string start with 0x");
            }
        }
        const psbt = yield tx.createSignedPsbt(txInfo);
        if (dump) {
            tx.dumpTx(psbt);
        }
        return psbt;
    });
}
exports.createSendOrd = createSendOrd;
function createSendMultiOrds({ utxos, toAddress, toOrdIds, receivers, wallet, network, changeAddress, pubkey, feeRate, dump, data, txInfo, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const tx = new OrdTransaction_1.OrdTransaction(wallet, network, pubkey, feeRate);
        yield tx.initBitcoin();
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
        if (data)
            tx.addOpReturnOutput(data);
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
        const psbt = yield tx.createSignedPsbt(txInfo);
        if (dump) {
            tx.dumpTx(psbt);
        }
        return psbt;
    });
}
exports.createSendMultiOrds = createSendMultiOrds;
function createSendMultiBTC({ utxos, receivers, wallet, network, changeAddress, feeRate, pubkey, dump, data, txInfo, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const tx = new OrdTransaction_1.OrdTransaction(wallet, network, pubkey, feeRate);
        yield tx.initBitcoin();
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
        const psbt = yield tx.createSignedPsbt(txInfo);
        if (dump) {
            tx.dumpTx(psbt);
        }
        return psbt;
    });
}
exports.createSendMultiBTC = createSendMultiBTC;
function inscribe({ address, utxos, inscription, wallet, network, pubkey, feeRate, changeAddress, dump, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const ecc = yield (0, lib_1.initWasm)();
        bitcoin.initEccLib(ecc);
        const bip32 = (0, bip32_1.default)(ecc);
        const internalKey = bip32.fromSeed(rng(64), network);
        const internalPubkey = (0, OrdTransaction_1.toXOnly)(internalKey.publicKey);
        const asm = `${internalPubkey.toString("hex")} OP_CHECKSIG OP_0 OP_IF ${Buffer.from("ord", "utf8").toString("hex")} 01 ${Buffer.from(inscription.contentType, "utf8").toString("hex")} OP_0 ${inscription.body.toString("hex")} OP_ENDIF`;
        const leafScript = bitcoin.script.fromASM(asm);
        const scriptTree = {
            output: leafScript,
        };
        const redeem = {
            output: leafScript,
            redeemVersion: 192,
        };
        const { output, witness, address: receiveAddress, } = bitcoin.payments.p2tr({
            internalPubkey,
            scriptTree,
            redeem,
            network,
        });
        const txSize = 200 + inscription.body.length / 4;
        const tapLeafScript = {
            script: leafScript,
            leafVersion: 192,
            controlBlock: witness[witness.length - 1],
        };
        const fundPsbt = yield createSendBTC({
            utxos,
            toAddress: receiveAddress,
            toAmount: OrdUnspendOutput_1.UTXO_DUST + txSize * feeRate,
            wallet,
            pubkey,
            network,
            feeRate,
            changeAddress,
            dump: true,
        });
        const tx = new OrdTransaction_1.OrdTransaction(wallet, network, pubkey, feeRate);
        const txid = yield wallet.pushPsbt(fundPsbt.toHex());
        yield new Promise((resolve) => setTimeout(resolve, 1000));
        const psbt = new bitcoin.Psbt({ network });
        psbt.addInput({
            hash: txid,
            index: 0,
            witnessUtxo: { value: OrdUnspendOutput_1.UTXO_DUST + txSize * feeRate, script: output },
        });
        psbt.updateInput(0, {
            tapLeafScript: [
                {
                    leafVersion: redeem.redeemVersion,
                    script: redeem.output,
                    controlBlock: witness[witness.length - 1],
                },
            ],
        });
        psbt.addOutput({ value: OrdUnspendOutput_1.UTXO_DUST, address });
        yield psbt.signInputAsync(0, internalKey);
        const customFinalizer = (_inputIndex, input) => {
            const scriptSolution = [input.tapScriptSig[0].signature];
            const witness = scriptSolution
                .concat(tapLeafScript.script)
                .concat(tapLeafScript.controlBlock);
            return {
                finalScriptWitness: (0, utils_1.witnessStackToScriptWitness)(witness),
            };
        };
        psbt.finalizeInput(0, customFinalizer);
        if (dump) {
            tx.dumpTx(psbt);
        }
        return psbt;
    });
}
exports.inscribe = inscribe;
function inscribeWithOneStep({ address, utxos, inscription, wallet, network, pubkey, feeRate, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const ecc = yield (0, lib_1.initWasm)();
        bitcoin.initEccLib(ecc);
        const internalPubkey = (0, OrdTransaction_1.toXOnly)(Buffer.from(pubkey, "hex"));
        const asm = `${internalPubkey.toString("hex")} OP_CHECKSIG OP_0 OP_IF ${Buffer.from("ord", "utf8").toString("hex")} 01 ${Buffer.from(inscription.contentType, "utf8").toString("hex")} OP_0 ${inscription.body.toString("hex")} OP_ENDIF`;
        const leafScript = bitcoin.script.fromASM(asm);
        const scriptTree = {
            output: leafScript,
        };
        const redeem = {
            output: leafScript,
            redeemVersion: 192,
        };
        const { witness, output } = bitcoin.payments.p2tr({
            pubkey: internalPubkey,
            scriptTree,
            redeem,
            network,
        });
        let psbt = new bitcoin.Psbt({ network });
        const txSize = 200 + inscription.body.length / 4;
        psbt.addInput({
            hash: utxos[0].txId,
            index: utxos[0].outputIndex,
            witnessUtxo: { value: OrdUnspendOutput_1.UTXO_DUST + txSize * feeRate, script: output },
        });
        psbt.updateInput(0, {
            tapLeafScript: [
                {
                    leafVersion: redeem.redeemVersion,
                    script: redeem.output,
                    controlBlock: witness[witness.length - 1],
                },
            ],
        });
        psbt.addOutput({ value: OrdUnspendOutput_1.UTXO_DUST, address });
        yield psbt.signAllInputsAsync(wallet.signer, { to: address, value: OrdUnspendOutput_1.UTXO_DUST.toString() });
        // const customFinalizer = (_inputIndex: number, input: any) => {
        //   console.log({input});
        //   const scriptSolution = [input.tapScriptSig[0].signature];
        //   const witness = scriptSolution
        //     .concat(tapLeafScript.script)
        //     .concat(tapLeafScript.controlBlock);
        //   return {
        //     finalScriptWitness: witnessStackToScriptWitness(witness),
        //   };
        // };
        psbt.finalizeAllInputs();
        return psbt;
    });
}
exports.inscribeWithOneStep = inscribeWithOneStep;
