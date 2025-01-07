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
exports.OrdTransaction = exports.utxoToInput = exports.toXOnly = exports.AddressType = void 0;
const OrdUnspendOutput_1 = require("./OrdUnspendOutput");
const bitcoin = __importStar(require("bitcoinjs-lib"));
const ord_utils_tiny_secp256k1_1 = require("ord-utils-tiny-secp256k1");
var AddressType;
(function (AddressType) {
    AddressType[AddressType["P2PKH"] = 0] = "P2PKH";
    AddressType[AddressType["P2WPKH"] = 1] = "P2WPKH";
    AddressType[AddressType["P2TR"] = 2] = "P2TR";
    AddressType[AddressType["P2SH_P2WPKH"] = 3] = "P2SH_P2WPKH";
    AddressType[AddressType["M44_P2WPKH"] = 4] = "M44_P2WPKH";
    AddressType[AddressType["M44_P2TR"] = 5] = "M44_P2TR";
})(AddressType = exports.AddressType || (exports.AddressType = {}));
function getAddressInputSize(type) {
    switch (type) {
        case AddressType.P2WPKH:
            return 68;
        case AddressType.P2TR:
            return 57.5;
        case AddressType.P2SH_P2WPKH:
            return 91;
        case AddressType.M44_P2WPKH:
            return 68;
        case AddressType.M44_P2TR:
            return 57.5;
        case AddressType.P2PKH:
            return 148;
    }
}
function getAddressOutputSize(output) {
    // OP_RETURN
    if (output.script) {
        return 8 + 1 + output.script.length;
    }
    const address = output.address;
    // P2TR address
    if (address.startsWith("bc1p") || address.startsWith("tb1p")) {
        return 43;
    }
    // P2WPKH address
    if (address.startsWith("bc1q") || address.startsWith("tb1q")) {
        return 31;
    }
    // P2SH address
    if (address.startsWith("2") || address.startsWith("3")) {
        return 32;
    }
    // P2PKH
    return 34;
}
const toXOnly = (pubKey) => pubKey.length === 32 ? pubKey : pubKey.slice(1, 33);
exports.toXOnly = toXOnly;
function utxoToInput(utxo) {
    if (utxo.addressType === AddressType.P2TR ||
        utxo.addressType === AddressType.M44_P2TR) {
        const data = {
            hash: utxo.txId,
            index: utxo.outputIndex,
            witnessUtxo: {
                value: utxo.satoshis,
                script: Buffer.from(utxo.scriptPk, "hex"),
            },
            tapInternalKey: (0, exports.toXOnly)(Buffer.from(utxo.pubkey, 'hex')),
        };
        return {
            data,
            utxo,
        };
    }
    else if (utxo.addressType === AddressType.P2WPKH ||
        utxo.addressType === AddressType.M44_P2WPKH) {
        const data = {
            hash: utxo.txId,
            index: utxo.outputIndex,
            witnessUtxo: {
                value: utxo.satoshis,
                script: Buffer.from(utxo.scriptPk, "hex"),
            },
        };
        return {
            data,
            utxo,
        };
    }
    else if (utxo.addressType === AddressType.P2PKH) {
        const data = {
            hash: utxo.txId,
            index: utxo.outputIndex,
            witnessUtxo: {
                value: utxo.satoshis,
                script: Buffer.from(utxo.scriptPk, "hex"),
            },
        };
        return {
            data,
            utxo,
        };
    }
    else if (utxo.addressType === AddressType.P2SH_P2WPKH) {
        const redeemData = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(utxo.pubkey, 'hex') });
        const data = {
            hash: utxo.txId,
            index: utxo.outputIndex,
            witnessUtxo: {
                value: utxo.satoshis,
                script: Buffer.from(utxo.scriptPk, "hex"),
            },
            redeemScript: redeemData.output,
        };
        return {
            data,
            utxo,
        };
    }
}
exports.utxoToInput = utxoToInput;
class OrdTransaction {
    constructor(wallet, network, feeRate) {
        this.inputs = [];
        this.outputs = [];
        this.changeOutputIndex = -1;
        this.network = bitcoin.networks.bitcoin;
        this.wallet = wallet;
        this.network = network;
        this.feeRate = feeRate || 5;
    }
    initBitcoin() {
        return __awaiter(this, void 0, void 0, function* () {
            const ecc = yield (0, ord_utils_tiny_secp256k1_1.initWasm)();
            bitcoin.initEccLib(ecc);
        });
    }
    setChangeAddress(address) {
        this.changedAddress = address;
    }
    addInput(utxo) {
        this.inputs.push(utxoToInput(utxo));
    }
    getTotalInput() {
        return this.inputs.reduce((pre, cur) => pre + cur.data.witnessUtxo.value, 0);
    }
    getTotalOutput() {
        return this.outputs.reduce((pre, cur) => pre + cur.value, 0);
    }
    getUnspent() {
        return this.getTotalInput() - this.getTotalOutput();
    }
    isEnoughFee() {
        return __awaiter(this, void 0, void 0, function* () {
            const psbt1 = yield this.createSignedPsbt();
            if (psbt1.getFeeRate() >= this.feeRate) {
                return true;
            }
            else {
                return false;
            }
        });
    }
    calNetworkFee() {
        return __awaiter(this, void 0, void 0, function* () {
            // const psbt = await this.createPsbt();
            // psbt.data.inputs.forEach((v) => {
            //   if (v.finalScriptWitness) {
            //     txSize -= v.finalScriptWitness.length * 0.75;
            //   }
            // });
            // const fee = Math.ceil(txSize * this.feeRate);
            const type = this.inputs[0].utxo.addressType;
            const inputValue = getAddressInputSize(type);
            // @ts-ignore
            const outputSize = this.outputs.reduce((pre, cur) => pre + getAddressOutputSize(cur), 0);
            const fee = Math.ceil((inputValue * this.inputs.length + outputSize + 10.5) * this.feeRate);
            return fee;
        });
    }
    addOutput(address, value) {
        this.outputs.push({
            address,
            value,
        });
    }
    addOpReturnOutput(data) {
        const hexString = data.startsWith("0x") ? data.slice(2) : data;
        const embedData = Buffer.from(hexString, "hex");
        const embed = bitcoin.payments.embed({ data: [embedData] });
        this.outputs.push({
            script: embed.output,
            value: 0,
        });
    }
    addRunestone(data) {
        const hexString = data.startsWith("0x") ? data.slice(2) : data;
        this.outputs.push({
            script: Buffer.from(hexString, 'hex'),
            value: 0,
        });
    }
    getOutput(index) {
        return this.outputs[index];
    }
    addChangeOutput(value) {
        this.outputs.push({
            address: this.changedAddress,
            value,
        });
        this.changeOutputIndex = this.outputs.length - 1;
    }
    getChangeOutput() {
        return this.outputs[this.changeOutputIndex];
    }
    getChangeAmount() {
        const output = this.getChangeOutput();
        return output ? output.value : 0;
    }
    removeChangeOutput() {
        this.outputs.splice(this.changeOutputIndex, 1);
        this.changeOutputIndex = -1;
    }
    removeRecentOutputs(count) {
        this.outputs.splice(-count);
    }
    createSignedPsbt(txInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            const psbt = new bitcoin.Psbt({ network: this.network });
            const signInputs = {};
            for (let i = 0; i < this.inputs.length; i++) {
                let v = this.inputs[i];
                if (signInputs[v.utxo.address]) {
                    signInputs[v.utxo.address].push(i);
                }
                else {
                    signInputs[v.utxo.address] = [i];
                }
                if (v.utxo.addressType === AddressType.P2PKH) {
                    let txApiUrl;
                    // Dogecoin support
                    if ([0x9e, 0xf1].includes(this.network.wif)) {
                        txApiUrl = `https://test-doge-electrs.bool.network/tx/${v.utxo.txId}/hex`;
                    }
                    else {
                        txApiUrl =
                            `https://mempool.space${this.network.bech32 === bitcoin.networks.bitcoin.bech32
                                ? ""
                                : this.network.bech32 === bitcoin.networks.testnet.bech32
                                    ? "/testnet"
                                    : "/signet"}/api/tx/` +
                                v.utxo.txId +
                                "/hex";
                    }
                    const response = yield fetch(txApiUrl, {
                        method: "GET",
                        mode: "cors",
                        headers: { "CONTENT-TYPE": "text/plain" },
                        cache: "default",
                    });
                    if (response.status !== 200) {
                        throw new Error("Fetch raw tx failed");
                    }
                    const rawTx = yield response.text();
                    // @ts-ignore
                    v.data.nonWitnessUtxo = Buffer.from(rawTx, "hex");
                }
                psbt.addInput(v.data);
                psbt.setInputSequence(i, 0xfffffffd); // support RBF
            }
            ;
            this.outputs.forEach((v) => {
                psbt.addOutput(v);
            });
            const res = yield this.wallet.signPsbt(psbt.toBuffer().toString("hex"), {
                autoFinalized: false,
                signInputs
            });
            // For mydoge wallet, no need to finalize
            if (this.wallet.mydoge) {
                return res;
            }
            const signedPsbt = bitcoin.Psbt.fromHex(res, { network: this.network });
            try {
                return signedPsbt.finalizeAllInputs();
            }
            catch (_) {
                return signedPsbt;
            }
        });
    }
    createPsbt() {
        return __awaiter(this, void 0, void 0, function* () {
            const psbt = new bitcoin.Psbt({ network: this.network });
            this.inputs.forEach((v, index) => {
                if (v.utxo.addressType === AddressType.P2PKH) {
                    // @ts-ignore
                    psbt.__CACHE.__UNSAFE_SIGN_NONSEGWIT = true;
                }
                psbt.addInput(v.data);
                psbt.setInputSequence(index, 0xfffffffd); // support RBF
            });
            this.outputs.forEach((v) => {
                psbt.addOutput(v);
            });
            return psbt;
        });
    }
    generate(autoAdjust) {
        return __awaiter(this, void 0, void 0, function* () {
            // Try to estimate fee
            const unspent = this.getUnspent();
            this.addChangeOutput(Math.max(unspent, 0));
            const psbt1 = yield this.createSignedPsbt();
            // this.dumpTx(psbt1);
            this.removeChangeOutput();
            // todo: support changing the feeRate
            const txSize = psbt1.extractTransaction().toBuffer().length;
            const fee = txSize * this.feeRate;
            if (unspent > fee) {
                const left = unspent - fee;
                if (left > OrdUnspendOutput_1.UTXO_DUST) {
                    this.addChangeOutput(left);
                }
            }
            else {
                if (autoAdjust) {
                    this.outputs[0].value -= fee - unspent;
                }
            }
            const psbt2 = yield this.createSignedPsbt();
            const tx = psbt2.extractTransaction();
            const rawtx = tx.toHex();
            const toAmount = this.outputs[0].value;
            return {
                fee: psbt2.getFee(),
                rawtx,
                toSatoshis: toAmount,
                estimateFee: fee,
            };
        });
    }
    dumpTx(psbt) {
        return __awaiter(this, void 0, void 0, function* () {
            const tx = psbt.extractTransaction();
            const size = tx.toBuffer().length;
            const feePaid = psbt.getFee();
            const feeRate = (feePaid / size).toFixed(4);
            console.log(`
=============================================================================================
Summary
  txid:     ${tx.getId()}
  Size:     ${tx.byteLength()}
  Fee Paid: ${psbt.getFee()}
  Fee Rate: ${feeRate} sat/B
  Detail:   ${psbt.txInputs.length} Inputs, ${psbt.txOutputs.length} Outputs
----------------------------------------------------------------------------------------------
Inputs
${this.inputs
                .map((input, index) => {
                const str = `
=>${index} ${input.data.witnessUtxo.value} Sats
        lock-size: ${input.data.witnessUtxo.script.length}
        via ${input.data.hash} [${input.data.index}]
`;
                return str;
            })
                .join("")}
total: ${this.getTotalInput()} Sats
----------------------------------------------------------------------------------------------
Outputs
${this.outputs
                .map((output, index) => {
                const str = `
=>${index} ${output} ${output.value} Sats`;
                return str;
            })
                .join("")}

total: ${this.getTotalOutput() - feePaid} Sats
=============================================================================================
    `);
        });
    }
}
exports.OrdTransaction = OrdTransaction;
