import { initWasm } from "../packages/tiny-secp256k1/lib";
import {
  AddressType,
  InternalTransaction,
  OrdTransaction,
  UnspentOutput,
  toXOnly,
} from "./OrdTransaction";
import { UTXO_DUST } from "./OrdUnspendOutput";
import { satoshisToAmount, witnessStackToScriptWitness } from "./utils";
import * as bitcoin from "bitcoinjs-lib-mpc";
import BIP32Factory from "bip32";

export * from './utils'
const rng = require("randombytes");

export { initWasm } from "../packages/tiny-secp256k1/lib";

export async function createSendBTC({
  utxos,
  toAddress,
  toAmount,
  wallet,
  network,
  changeAddress,
  receiverToPayFee,
  feeRate,
  pubkey,
  dump,
  data,
  txInfo,
}: {
  utxos: UnspentOutput[];
  toAddress: string;
  toAmount: number;
  wallet: any;
  network: any;
  changeAddress: string;
  receiverToPayFee?: boolean;
  feeRate?: number;
  pubkey: string;
  dump?: boolean;
  data?: string;
  txInfo?: InternalTransaction;
}) {
  const tx = new OrdTransaction(wallet, network, pubkey, feeRate);
  await tx.initBitcoin();
  tx.setChangeAddress(changeAddress);

  const nonOrdUtxos: UnspentOutput[] = [];
  const ordUtxos: UnspentOutput[] = [];
  utxos.forEach((v) => {
    if (v.ords.length > 0) {
      ordUtxos.push(v);
    } else {
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

    const fee = await tx.calNetworkFee();
    if (tmpSum < outputAmount + fee) {
      tx.addInput(nonOrdUtxo);
      tmpSum += nonOrdUtxo.satoshis;
    } else {
      break;
    }
  }

  if (data) tx.addOpReturnOutput(data);

  if (nonOrdUtxos.length === 0) {
    throw new Error("Balance not enough");
  }

  if (receiverToPayFee) {
    const unspent = tx.getUnspent();
    if (unspent >= UTXO_DUST) {
      tx.addChangeOutput(unspent);
    }

    const networkFee = await tx.calNetworkFee();
    // @ts-ignore
    const output = tx.outputs.find((v) => v.address === toAddress);
    if (output.value < networkFee) {
      throw new Error(
        `Balance not enough. Need ${satoshisToAmount(
          networkFee
        )} BTC as network fee`
      );
    }
    output.value -= networkFee;
  } else {
    const unspent = tx.getUnspent();
    if (unspent === 0) {
      throw new Error("Balance not enough to pay network fee.");
    }

    // add dummy output
    tx.addChangeOutput(1);

    const networkFee = await tx.calNetworkFee();

    if (unspent < networkFee) {
      throw new Error(
        `Balance not enough. Need ${satoshisToAmount(
          networkFee
        )} BTC as network fee, but only ${satoshisToAmount(unspent)} BTC.`
      );
    }

    const leftAmount = unspent - networkFee;
    if (leftAmount >= UTXO_DUST) {
      // change dummy output to true output
      tx.getChangeOutput().value = leftAmount;
    } else {
      // remove dummy output
      tx.removeChangeOutput();
    }
  }

  const psbt = await tx.createSignedPsbt(txInfo);
  if (dump) {
    tx.dumpTx(psbt);
  }

  return psbt;
}

export async function createSendOrd({
  utxos,
  toAddress,
  toOrdId,
  wallet,
  network,
  changeAddress,
  pubkey,
  feeRate,
  outputValue,
  dump,
  data,
  txInfo,
}: {
  utxos: UnspentOutput[];
  toAddress: string;
  toOrdId: string;
  wallet: any;
  network: any;
  changeAddress: string;
  pubkey: string;
  feeRate?: number;
  outputValue: number;
  dump?: boolean;
  data?: string;
  txInfo?: InternalTransaction;
}) {
  const tx = new OrdTransaction(wallet, network, pubkey, feeRate);
  await tx.initBitcoin();
  tx.setChangeAddress(changeAddress);

  const nonOrdUtxos: UnspentOutput[] = [];
  const ordUtxos: UnspentOutput[] = [];
  utxos.forEach((v) => {
    if (v.ords.length > 0) {
      ordUtxos.push(v);
    } else {
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
      tx.addOutput(toAddress, UTXO_DUST);
      found = true;
      break;
    }
  }

  if (data) tx.addOpReturnOutput(data);

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

    const fee = await tx.calNetworkFee();
    if (tmpSum < outputAmount + fee) {
      tx.addInput(nonOrdUtxo);
      tmpSum += nonOrdUtxo.satoshis;
    } else {
      break;
    }
  }

  const unspent = tx.getUnspent();
  if (unspent == 0) {
    throw new Error("Balance not enough to pay network fee.");
  }

  // add dummy output
  tx.addChangeOutput(1);

  const networkFee = await tx.calNetworkFee();
  if (unspent < networkFee) {
    throw new Error(
      `Balance not enough. Need ${satoshisToAmount(
        networkFee
      )} BTC as network fee, but only ${satoshisToAmount(unspent)} BTC.`
    );
  }

  const leftAmount = unspent - networkFee;
  if (leftAmount >= UTXO_DUST) {
    // change dummy output to true output
    tx.getChangeOutput().value = leftAmount;
  } else {
    // remove dummy output
    tx.removeChangeOutput();
  }
  if (data) {
    try {
    } catch (error) {
      if (error instanceof Error && this.developMode) {
        console.log(error.message);
      }
      throw new Error(
        "Invalid transaction data, it should be a hex string start with 0x"
      );
    }
  }
  const psbt = await tx.createSignedPsbt(txInfo);
  if (dump) {
    tx.dumpTx(psbt);
  }

  return psbt;
}

export async function createSendMultiOrds({
  utxos,
  toAddress,
  toOrdIds,
  receivers,
  wallet,
  network,
  changeAddress,
  pubkey,
  feeRate,
  dump,
  data,
  txInfo,
}: {
  utxos: UnspentOutput[];
  toAddress: string;
  toOrdIds: string[];
  receivers: {
    address: string;
    amount: number;
  }[];
  wallet: any;
  network: any;
  changeAddress: string;
  pubkey: string;
  feeRate?: number;
  dump?: boolean;
  data?: string | string[];
  txInfo?: InternalTransaction;
}) {
  const tx = new OrdTransaction(wallet, network, pubkey, feeRate);
  await tx.initBitcoin();
  tx.setChangeAddress(changeAddress);

  const nonOrdUtxos: UnspentOutput[] = [];
  const ordUtxos: UnspentOutput[] = [];
  utxos.forEach((v) => {
    if (v.ords.length > 0) {
      ordUtxos.push(v);
    } else {
      nonOrdUtxos.push(v);
    }
  });

  // find NFT
  let foundedCount = 0;

  for (let i = 0; i < ordUtxos.length; i++) {
    const ordUtxo = ordUtxos[i];
    if (ordUtxo.ords.find((v) => toOrdIds.includes(v.id))) {
      if (ordUtxo.ords.length > 1) {
        throw new Error(
          "Multiple inscriptions in one UTXO! Please split them first."
        );
      }
      tx.addInput(ordUtxo);
      tx.addOutput(toAddress, UTXO_DUST);
      foundedCount++;
    }
  }

  receivers.forEach((v) => {
    tx.addOutput(v.address, v.amount);
  });

  if (Array.isArray(data)) { data.forEach(a =>  tx.addOpReturnOutput(a)); }
  else {
    if (data) tx.addOpReturnOutput(data);
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

    const fee = await tx.calNetworkFee();
    if (tmpSum < outputAmount + fee) {
      tx.addInput(nonOrdUtxo);
      tmpSum += nonOrdUtxo.satoshis;
    } else {
      break;
    }
  }

  const unspent = tx.getUnspent();
  if (unspent == 0) {
    throw new Error("Balance not enough to pay network fee.");
  }

  // add dummy output
  tx.addChangeOutput(1);
  const networkFee = await tx.calNetworkFee();
  if (unspent < networkFee) {
    throw new Error(
      `Balance not enough. Need ${satoshisToAmount(
        networkFee
      )} BTC as network fee, but only ${satoshisToAmount(unspent)} BTC.`
    );
  }

  const leftAmount = unspent - networkFee;
  if (leftAmount >= UTXO_DUST) {
    // change dummy output to true output
    tx.getChangeOutput().value = leftAmount;
  } else {
    // remove dummy output
    tx.removeChangeOutput();
  }

  const psbt = await tx.createSignedPsbt(txInfo);
  if (dump) {
    tx.dumpTx(psbt);
  }

  return psbt;
}

export async function createSendMultiBTC({
  utxos,
  receivers,
  wallet,
  network,
  changeAddress,
  feeRate,
  pubkey,
  dump,
  data,
  txInfo,
}: {
  utxos: UnspentOutput[];
  receivers: {
    address: string;
    amount: number;
  }[];
  wallet: any;
  network: any;
  changeAddress: string;
  feeRate?: number;
  pubkey: string;
  dump?: boolean;
  data?: string;
  txInfo?: InternalTransaction;
}) {
  const tx = new OrdTransaction(wallet, network, pubkey, feeRate);
  await tx.initBitcoin();
  tx.setChangeAddress(changeAddress);

  const nonOrdUtxos: UnspentOutput[] = [];
  const ordUtxos: UnspentOutput[] = [];
  utxos.forEach((v) => {
    if (v.ords.length > 0) {
      ordUtxos.push(v);
    } else {
      nonOrdUtxos.push(v);
    }
  });

  receivers.forEach((v) => {
    tx.addOutput(v.address, v.amount);
  });

  if (data) tx.addOpReturnOutput(data);

  const outputAmount = tx.getTotalOutput();

  let tmpSum = tx.getTotalInput();
  for (let i = 0; i < nonOrdUtxos.length; i++) {
    const nonOrdUtxo = nonOrdUtxos[i];
    if (tmpSum < outputAmount) {
      tx.addInput(nonOrdUtxo);
      tmpSum += nonOrdUtxo.satoshis;
      continue;
    }

    const fee = await tx.calNetworkFee();
    if (tmpSum < outputAmount + fee) {
      tx.addInput(nonOrdUtxo);
      tmpSum += nonOrdUtxo.satoshis;
    } else {
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

  const networkFee = await tx.calNetworkFee();
  if (unspent < networkFee) {
    throw new Error(
      `Balance not enough. Need ${satoshisToAmount(
        networkFee
      )} BTC as network fee, but only ${satoshisToAmount(unspent)} BTC.`
    );
  }

  const leftAmount = unspent - networkFee;
  if (leftAmount >= UTXO_DUST) {
    // change dummy output to true output
    tx.getChangeOutput().value = leftAmount;
  } else {
    // remove dummy output
    tx.removeChangeOutput();
  }

  const psbt = await tx.createSignedPsbt(txInfo);
  if (dump) {
    tx.dumpTx(psbt);
  }

  return psbt;
}

export async function createSendRunes({
  utxos,
  receivers,
  wallet,
  network,
  changeAddress,
  feeRate,
  pubkey,
  dump,
  data,
  runestone,
  txInfo,
}: {
  utxos: UnspentOutput[];
  receivers: {
    address: string;
    amount: number;
  }[];
  wallet: any;
  network: any;
  changeAddress: string;
  feeRate?: number;
  pubkey: string;
  dump?: boolean;
  data?: string;
  runestone?: string;
  txInfo?: InternalTransaction;
}) {
  const tx = new OrdTransaction(wallet, network, pubkey, feeRate);
  await tx.initBitcoin();
  tx.setChangeAddress(changeAddress);

  const nonRunesUtxos: UnspentOutput[] = [];
  const runesUtxos: UnspentOutput[] = [];
  utxos.forEach((v) => {
    if (v.runes && v.runes.length > 0) {
      runesUtxos.push(v);
    } else {
      nonRunesUtxos.push(v);
    }
  });

  receivers.forEach((v) => {
    tx.addOutput(v.address, v.amount);
  });

  if (data) tx.addOpReturnOutput(data);
  if (runestone) tx.addRunestone(runestone);

  const outputAmount = tx.getTotalOutput();

  let tmpSum = tx.getTotalInput();
  for (let i = 0; i < nonRunesUtxos.length; i++) {
    const nonRunesUtxo = nonRunesUtxos[i];
    if (tmpSum < outputAmount) {
      tx.addInput(nonRunesUtxo);
      tmpSum += nonRunesUtxo.satoshis;
      continue;
    }

    const fee = await tx.calNetworkFee();
    if (tmpSum < outputAmount + fee) {
      tx.addInput(nonRunesUtxo);
      tmpSum += nonRunesUtxo.satoshis;
    } else {
      break;
    }
  }


  if (nonRunesUtxos.length === 0) {
    throw new Error("Balance not enough");
  }

  const unspent = tx.getUnspent();
  if (unspent === 0) {
    throw new Error("Balance not enough to pay network fee.");
  }

  // add dummy output
  tx.addChangeOutput(1);

  const networkFee = await tx.calNetworkFee();
  if (unspent < networkFee) {
    throw new Error(
      `Balance not enough. Need ${satoshisToAmount(
        networkFee
      )} BTC as network fee, but only ${satoshisToAmount(unspent)} BTC.`
    );
  }

  const leftAmount = unspent - networkFee;
  if (leftAmount >= UTXO_DUST) {
    // change dummy output to true output
    tx.getChangeOutput().value = leftAmount;
  } else {
    // remove dummy output
    tx.removeChangeOutput();
  }

  const psbt = await tx.createSignedPsbt(txInfo);
  if (dump) {
    tx.dumpTx(psbt);
  }

  return psbt;
}

export async function inscribe({
  address,
  utxos,
  inscription,
  wallet,
  network,
  pubkey,
  feeRate,
  changeAddress,
  dump,
}: {
  address: string;
  utxos: UnspentOutput[];
  inscription: { body: Buffer; contentType: string };
  wallet: any;
  network: any;
  pubkey: string;
  changeAddress: string;
  feeRate: number;
  dump: boolean;
}) {
  const ecc = await initWasm();
  bitcoin.initEccLib(ecc);
  const bip32 = BIP32Factory(ecc);
  const internalKey = bip32.fromSeed(rng(64), network);
  const internalPubkey = toXOnly(internalKey.publicKey);
  const asm = `${internalPubkey.toString(
    "hex"
  )} OP_CHECKSIG OP_0 OP_IF ${Buffer.from("ord", "utf8").toString(
    "hex"
  )} 01 ${Buffer.from(inscription.contentType, "utf8").toString(
    "hex"
  )} OP_0 ${inscription.body.toString("hex")} OP_ENDIF`;
  const leafScript = bitcoin.script.fromASM(asm);

  const scriptTree = {
    output: leafScript,
  };
  const redeem = {
    output: leafScript,
    redeemVersion: 192,
  };
  const {
    output,
    witness,
    address: receiveAddress,
  } = bitcoin.payments.p2tr({
    internalPubkey,
    scriptTree,
    redeem,
    network,
  });
  const txSize = 200 + inscription.body.length / 4;
  const tapLeafScript = {
    script: leafScript,
    leafVersion: 192,
    controlBlock: witness![witness!.length - 1],
  };

  const fundPsbt = await createSendBTC({
    utxos,
    toAddress: receiveAddress,
    toAmount: UTXO_DUST + txSize * feeRate,
    wallet,
    pubkey,
    network,
    feeRate,
    changeAddress,
    dump: true,
  });

  const tx = new OrdTransaction(wallet, network, pubkey, feeRate);
  const txid = await wallet.pushPsbt(fundPsbt.toHex());
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const psbt = new bitcoin.Psbt({ network });

  psbt.addInput({
    hash: txid,
    index: 0,
    witnessUtxo: { value: UTXO_DUST + txSize * feeRate, script: output! },
  });

  psbt.updateInput(0, {
    tapLeafScript: [
      {
        leafVersion: redeem.redeemVersion,
        script: redeem.output,
        controlBlock: witness![witness!.length - 1],
      },
    ],
  });
  psbt.addOutput({ value: UTXO_DUST, address });
  await psbt.signInputAsync(0, internalKey);
  const customFinalizer = (_inputIndex: number, input: any) => {
    const scriptSolution = [input.tapScriptSig[0].signature];
    const witness = scriptSolution
      .concat(tapLeafScript.script)
      .concat(tapLeafScript.controlBlock);

    return {
      finalScriptWitness: witnessStackToScriptWitness(witness),
    };
  };
  psbt.finalizeInput(0, customFinalizer);
  if (dump) {
    tx.dumpTx(psbt);
  }

  return psbt;
}

export async function inscribeWithOneStep({
  address,
  utxos,
  inscription,
  wallet,
  network,
  pubkey,
  feeRate,
}: {
  address: string;
  utxos: UnspentOutput[];
  inscription: { body: Buffer; contentType: string };
  wallet: any;
  network: any;
  pubkey: string;
  changeAddress: string;
  feeRate: number;
  dump: boolean;
}) {
  const ecc = await initWasm();
  bitcoin.initEccLib(ecc);
  const internalPubkey = toXOnly(Buffer.from(pubkey, "hex"));
  const asm = `${internalPubkey.toString(
    "hex"
  )} OP_CHECKSIG OP_0 OP_IF ${Buffer.from("ord", "utf8").toString(
    "hex"
  )} 01 ${Buffer.from(inscription.contentType, "utf8").toString(
    "hex"
  )} OP_0 ${inscription.body.toString("hex")} OP_ENDIF`;
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
    witnessUtxo: { value: UTXO_DUST + txSize * feeRate, script: output! },

  });
  psbt.updateInput(0, {
    tapLeafScript: [
      {
        leafVersion: redeem.redeemVersion,
        script: redeem.output,
        controlBlock: witness![witness!.length - 1],
      },
    ],
  });
  psbt.addOutput({ value: UTXO_DUST, address });

  await psbt.signAllInputsAsync(wallet.signer, {to: address, value: UTXO_DUST.toString()});
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
}
