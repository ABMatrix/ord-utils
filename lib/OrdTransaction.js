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
const tiny_secp256k1_1 = require("../packages/tiny-secp256k1");
const INPUT_RATE = 68;
const OUTPUT_RATE = 31;
var AddressType;
(function (AddressType) {
    AddressType[AddressType["P2PKH"] = 0] = "P2PKH";
    AddressType[AddressType["P2WPKH"] = 1] = "P2WPKH";
    AddressType[AddressType["P2TR"] = 2] = "P2TR";
    AddressType[AddressType["P2SH_P2WPKH"] = 3] = "P2SH_P2WPKH";
    AddressType[AddressType["M44_P2WPKH"] = 4] = "M44_P2WPKH";
    AddressType[AddressType["M44_P2TR"] = 5] = "M44_P2TR";
})(AddressType = exports.AddressType || (exports.AddressType = {}));
const toXOnly = (pubKey) => pubKey.length === 32 ? pubKey : pubKey.slice(1, 33);
exports.toXOnly = toXOnly;
function utxoToInput(utxo, publicKey) {
    if (utxo.addressType === AddressType.P2TR ||
        utxo.addressType === AddressType.M44_P2TR) {
        const data = {
            hash: utxo.txId,
            index: utxo.outputIndex,
            witnessUtxo: {
                value: utxo.satoshis,
                script: Buffer.from(utxo.scriptPk, "hex"),
            },
            tapInternalKey: (0, exports.toXOnly)(publicKey),
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
        const redeemData = bitcoin.payments.p2wpkh({ pubkey: publicKey });
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
    constructor(wallet, network, pubkey, feeRate) {
        this.inputs = [];
        this.outputs = [];
        this.opReturnOutputs = [];
        this.changeOutputIndex = -1;
        this.network = bitcoin.networks.bitcoin;
        this.wallet = wallet;
        this.network = network;
        this.pubkey = pubkey;
        this.feeRate = feeRate || 5;
    }
    initBitcoin() {
        return __awaiter(this, void 0, void 0, function* () {
            const ecc = yield (0, tiny_secp256k1_1.initWasm)();
            bitcoin.initEccLib(ecc);
        });
    }
    setChangeAddress(address) {
        this.changedAddress = address;
    }
    addInput(utxo) {
        this.inputs.push(utxoToInput(utxo, Buffer.from(this.pubkey, "hex")));
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
            // const psbt = await this.createSignedPsbt();
            // let txSize = psbt.extractTransaction(true).toBuffer().length;
            // psbt.data.inputs.forEach((v) => {
            //   if (v.finalScriptWitness) {
            //     txSize -= v.finalScriptWitness.length * 0.75;
            //   }
            // });
            // const fee = Math.ceil(txSize * this.feeRate);
            const fee = Math.ceil(((INPUT_RATE * this.inputs.length) + OUTPUT_RATE * this.outputs.length + 10.5) * this.feeRate);
            return fee;
        });
    }
    addOutput(address, value) {
        this.outputs.push({
            address,
            value,
        });
    }
    addOpRetunOutput(data) {
        const hexString = data.startsWith('0x') ? data.slice(2) : data;
        const embedData = Buffer.from(hexString, 'hex');
        const embed = bitcoin.payments.embed({ data: [embedData] });
        this.opReturnOutputs.push({
            script: embed.output,
            value: OrdUnspendOutput_1.UTXO_DUST,
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
    createSignedPsbt() {
        return __awaiter(this, void 0, void 0, function* () {
            const psbt = new bitcoin.Psbt({ network: this.network });
            this.inputs.forEach((v, index) => {
                if (v.utxo.addressType === AddressType.P2PKH) {
                    //@ts-ignore
                    psbt.__CACHE.__UNSAFE_SIGN_NONSEGWIT = true;
                }
                psbt.addInput(v.data);
                psbt.setInputSequence(index, 0xfffffffd); // support RBF
            });
            this.outputs.forEach((v) => {
                psbt.addOutput(v);
            });
            this.opReturnOutputs.forEach((v) => { psbt.addOutput(v); });
            const res = yield this.wallet.signPsbt(psbt.toBuffer().toString("hex"));
            return bitcoin.Psbt.fromHex(res);
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
=>${index} ${output.address} ${output.value} Sats`;
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
