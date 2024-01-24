import { UTXO_DUST } from "./OrdUnspendOutput";
import * as bitcoin from "bitcoinjs-lib-mpc";

import { initWasm } from "../packages/tiny-secp256k1";

const OUTPUT_RATE = 43

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
  amount: string
}
export interface UnspentOutput {
  txId: string;
  outputIndex: number;
  satoshis: number;
  scriptPk: string;
  addressType: AddressType;
  address: string;
  ords: {
    id: string;
    offset: number;
  }[];
  tapMerkelRoot?: string;
  tapLeafScript?: any
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
      return 68
    case AddressType.P2TR:
      return 57.5
    case AddressType.P2SH_P2WPKH:
      return 91
    case AddressType.M44_P2WPKH:
      return 68
    case AddressType.M44_P2TR:
      return 68
    case AddressType.P2PKH:
      return 146.5
  }
}

function getAddressOutputSize(output) {
  // OP_RETURN
  if( output.script) {
    return 8 + 1 + output.script.length
  }
  const address = output.address
  // P2TR address
  if(address.startsWith('bc1p') || address.startsWith('tb1p')) {
    return 43;
  }
  // P2WPKH address
  if(address.startsWith('bc1q') || address.startsWith('tb1q')) {
    return 31
  }
  // P2SH address
  if(address.startsWith('2') || address.startsWith('3')) {
    return 32
  }
  // P2PKH
  return 34
}

export const toXOnly = (pubKey: Buffer) =>
  pubKey.length === 32 ? pubKey : pubKey.slice(1, 33);

export function utxoToInput(utxo: UnspentOutput, publicKey: Buffer): TxInput {
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
      tapInternalKey: toXOnly(publicKey),
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

export class OrdTransaction {
  public inputs: TxInput[] = [];
  public outputs: (TxOutput | OpReturnOutput)[] = [];
  private changeOutputIndex = -1;
  private wallet: any;
  public changedAddress: string;
  private network: bitcoin.Network = bitcoin.networks.bitcoin;
  private feeRate: number;
  private pubkey: string;
  
  constructor(wallet: any, network: any, pubkey: string, feeRate?: number) {
    this.wallet = wallet;
    this.network = network;
    this.pubkey = pubkey;
    this.feeRate = feeRate || 5;
  }

  async initBitcoin() {
    const ecc = await initWasm()
    bitcoin.initEccLib(ecc);
  }

  setChangeAddress(address: string) {
    this.changedAddress = address;
  }

  addInput(utxo: UnspentOutput) {
    this.inputs.push(utxoToInput(utxo, Buffer.from(this.pubkey, "hex")));
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
    const type = this.inputs[0].utxo.addressType
    const inputValue = getAddressInputSize(type)
    // @ts-ignore
    const outputSize = this.outputs.reduce((pre, cur) => pre + getAddressOutputSize(cur), 0)
    const fee = Math.ceil(((inputValue * this.inputs.length) + outputSize + 10.5) * this.feeRate)
    return fee;
  }

  addOutput(address: string, value: number) {
    this.outputs.push({
      address,
      value,
    });
  }

  addOpReturnOutput(data: string) {
      const hexString = data.startsWith('0x') ? data.slice(2) : data
      const embedData = Buffer.from(hexString, 'hex')
      const embed = bitcoin.payments.embed({ data: [embedData] })
      this.outputs.push({
        script: embed.output!,
        value: 0,
      })
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
    const res = await this.wallet.signPsbt(psbt.toBuffer().toString("hex"), txInfo);
    return bitcoin.Psbt.fromHex(res, {network: this.network});
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
    return psbt
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
