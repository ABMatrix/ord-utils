import { UTXO_DUST } from "./OrdUnspendOutput";
import * as bitcoin from "bitcoinjs-lib";

import { initWasm } from "ord-utils-tiny-secp256k1";
interface TxInput {
  data: {
    hash: string;
    index: number;
    witnessUtxo: { value: number; script: Buffer };
    tapInternalKey?: Buffer;
  };
  utxo: UnspentOutput;
}

interface TxOutput {
  address: string;
  value: number;
}

interface OpReturnOutput {
  script: Buffer;
  value: number;
}

export interface InternalTransaction {
  form?: string;
  type?: string;
  to: string;
  amount: string;
}
export interface UnspentOutput {
  txId: string;
  outputIndex: number;
  satoshis: number;
  scriptPk: string;
  addressType: AddressType;
  address: string;
  pubkey: string;
  ords: {
    id: string;
    offset: number;
  }[];
  runes?: {
    runeid: string;
    amount: string;
    rune: string
  }[],
  tapMerkelRoot?: string;
  tapLeafScript?: any;
}
export enum AddressType {
  P2PKH,
  P2WPKH,
  P2TR,
  P2SH_P2WPKH,
  M44_P2WPKH,
  M44_P2TR,
}

function getAddressInputSize(type: AddressType) {
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

export const toXOnly = (pubKey: Buffer) =>
  pubKey.length === 32 ? pubKey : pubKey.slice(1, 33);

export function utxoToInput(utxo: UnspentOutput): TxInput {
  if (
    utxo.addressType === AddressType.P2TR ||
    utxo.addressType === AddressType.M44_P2TR
  ) {
    const data = {
      hash: utxo.txId,
      index: utxo.outputIndex,
      witnessUtxo: {
        value: utxo.satoshis,
        script: Buffer.from(utxo.scriptPk, "hex"),
      },
      tapInternalKey: toXOnly(Buffer.from(utxo.pubkey, 'hex')),
    };
    return {
      data,
      utxo,
    };
  } else if (
    utxo.addressType === AddressType.P2WPKH ||
    utxo.addressType === AddressType.M44_P2WPKH
  ) {
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
  } else if (utxo.addressType === AddressType.P2PKH) {
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
  } else if (utxo.addressType === AddressType.P2SH_P2WPKH) {
    const redeemData = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(utxo.pubkey, 'hex')});
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

export class OrdTransaction {
  public inputs: TxInput[] = [];
  public outputs: (TxOutput | OpReturnOutput)[] = [];
  private changeOutputIndex = -1;
  private wallet: any;
  public changedAddress: string;
  private network: bitcoin.Network = bitcoin.networks.bitcoin;
  private feeRate: number;
  private pubkey: string;

  constructor(wallet: any, network: any, feeRate?: number) {
    this.wallet = wallet;
    this.network = network;
    this.feeRate = feeRate || 5;
  }

  async initBitcoin() {
    const ecc = await initWasm();
    bitcoin.initEccLib(ecc);
  }

  setChangeAddress(address: string) {
    this.changedAddress = address;
  }

  addInput(utxo: UnspentOutput) {
    this.inputs.push(utxoToInput(utxo));
  }

  getTotalInput() {
    return this.inputs.reduce(
      (pre, cur) => pre + cur.data.witnessUtxo.value,
      0
    );
  }

  getTotalOutput() {
    return this.outputs.reduce((pre, cur) => pre + cur.value, 0);

  }
  getUnspent() {
    return this.getTotalInput() - this.getTotalOutput();
  }

  async isEnoughFee() {
    const psbt1 = await this.createSignedPsbt();
    if (psbt1.getFeeRate() >= this.feeRate) {
      return true;
    } else {
      return false;
    }
  }

  async calNetworkFee() {
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
    const outputSize = this.outputs.reduce(
      (pre, cur) => pre + getAddressOutputSize(cur),
      0
    );
    const fee = Math.ceil(
      (inputValue * this.inputs.length + outputSize + 10.5) * this.feeRate
    );
    return fee;
  }

  addOutput(address: string, value: number) {
    this.outputs.push({
      address,
      value,
    });
  }

  addOpReturnOutput(data: string) {
    const hexString = data.startsWith("0x") ? data.slice(2) : data;
    const embedData = Buffer.from(hexString, "hex");
    const embed = bitcoin.payments.embed({ data: [embedData] });
    this.outputs.push({
      script: embed.output!,
      value: 0,
    });
  }
  addRunestone(data: string) {
    const hexString = data.startsWith("0x") ? data.slice(2) : data;
    this.outputs.push({
      script: Buffer.from(hexString, 'hex'),
      value: 0,
    });
  }

  getOutput(index: number) {
    return this.outputs[index];
  }

  addChangeOutput(value: number) {
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

  removeRecentOutputs(count: number) {
    this.outputs.splice(-count);
  }

  async createSignedPsbt(txInfo?: InternalTransaction) {
    const psbt = new bitcoin.Psbt({ network: this.network });
    const signInputs: any = {}
    for(let i = 0; i < this.inputs.length; i++) {
      let v = this.inputs[i];
      if (signInputs[v.utxo.address]) {
        signInputs[v.utxo.address].push(i);
      } else {
        signInputs[v.utxo.address] = [i];
      }
      if (v.utxo.addressType === AddressType.P2PKH) {
        let txApiUrl: string;
        // Dogecoin support
        if( [0x9e, 0xf1].includes(this.network.wif) ) {
          txApiUrl = `https://test-doge-electrs.bool.network/tx/${v.utxo.txId}/hex`;
        } else {
          txApiUrl =
            `https://mempool.space${
              this.network.bech32 === bitcoin.networks.bitcoin.bech32
                ? ""
                : this.network.bech32 === bitcoin.networks.testnet.bech32
                ? "/testnet"
                : "/signet"
            }/api/tx/` +
            v.utxo.txId +
            "/hex";
        }
        const response = await fetch(txApiUrl, {
          method: "GET",
          mode: "cors",
          headers: {"CONTENT-TYPE": "text/plain"},
          cache: "default",
        });
        if (response.status !== 200) {
          throw new Error("Fetch raw tx failed");
        }
        const rawTx = await response.text();
        // @ts-ignore
        v.data.nonWitnessUtxo = Buffer.from(rawTx, "hex");
      }
      psbt.addInput(v.data);
      psbt.setInputSequence(i, 0xfffffffd); // support RBF
    };

    this.outputs.forEach((v) => {
      psbt.addOutput(v);
    });
    const res = await this.wallet.signPsbt(
      psbt.toBuffer().toString("hex"),
      {
        autoFinalized: false,
        signInputs
      }
    );
    // For mydoge wallet, no need to finalize
    if(this.wallet.mydoge) {
      return res;
    }
    const signedPsbt = bitcoin.Psbt.fromHex(res, { network: this.network });
    try {
      return signedPsbt.finalizeAllInputs();
    } catch (_) {
      return signedPsbt;
    }
  }

  async createPsbt() {
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
  }

  async generate(autoAdjust: boolean) {
    // Try to estimate fee
    const unspent = this.getUnspent();
    this.addChangeOutput(Math.max(unspent, 0));
    const psbt1 = await this.createSignedPsbt();
    // this.dumpTx(psbt1);
    this.removeChangeOutput();

    // todo: support changing the feeRate
    const txSize = psbt1.extractTransaction().toBuffer().length;
    const fee = txSize * this.feeRate;

    if (unspent > fee) {
      const left = unspent - fee;
      if (left > UTXO_DUST) {
        this.addChangeOutput(left);
      }
    } else {
      if (autoAdjust) {
        this.outputs[0].value -= fee - unspent;
      }
    }
    const psbt2 = await this.createSignedPsbt();
    const tx = psbt2.extractTransaction();

    const rawtx = tx.toHex();
    const toAmount = this.outputs[0].value;
    return {
      fee: psbt2.getFee(),
      rawtx,
      toSatoshis: toAmount,
      estimateFee: fee,
    };
  }

  async dumpTx(psbt) {
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
  }
}
