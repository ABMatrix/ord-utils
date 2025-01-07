import {
  OrdTransaction,
  UnspentOutput,
} from "./OrdTransaction";
import { UTXO_DUST } from "./OrdUnspendOutput";
import { satoshisToAmount } from "./utils";

export * from './utils'

export async function createSendBTC({
  utxos,
  toAddress,
  toAmount,
  wallet,
  network,
  changeAddress,
  receiverToPayFee,
  feeRate,
  dump,
  data,
}: {
  utxos: UnspentOutput[];
  toAddress: string;
  toAmount: number;
  wallet: any;
  network: any;
  changeAddress: string;
  receiverToPayFee?: boolean;
  feeRate?: number;
  dump?: boolean;
  data?: string;
}) {
  const tx = new OrdTransaction(wallet, network, feeRate);
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

  const psbt = await tx.createSignedPsbt();
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
  feeRate,
  dump,
  data,
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
  feeRate?: number;
  dump?: boolean;
  data?: string | string[];
}) {
  const tx = new OrdTransaction(wallet, network, feeRate);
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

  const psbt = await tx.createSignedPsbt();
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
  dump,
  data,
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
  dump?: boolean;
  data?: string;
}) {
  const tx = new OrdTransaction(wallet, network, feeRate);
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

  const psbt = await tx.createSignedPsbt();
  console.log({ psbt })
  if (dump) {
    tx.dumpTx(psbt);
  }

  return psbt;
}

export async function createSendMaxBTC({
  utxos,
  receivers,
  wallet,
  network,
  changeAddress,
  feeRate,
  dump,
  data,
}: {
  utxos: UnspentOutput[];
  receivers: {
    address: string;
    amount?: number;
  }[];
  wallet: any;
  network: any;
  changeAddress: string;
  feeRate?: number;
  dump?: boolean;
  data?: string;
}) {
  const tx = new OrdTransaction(wallet, network, feeRate);
  tx.setChangeAddress(changeAddress);
  const to = receivers.find((v) => v.amount === undefined).address;
  if(!to) {
    throw new Error("No receiver found, please provide one receiver with undefined amount");
  }
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
    if(v.amount) {
      tx.addOutput(v.address, v.amount);
    } else {
      tx.addOutput(v.address, 0);
    }
  });

  if (data) tx.addOpReturnOutput(data);

  const outputAmount = tx.getTotalOutput();

  if (nonOrdUtxos.length === 0) {
    throw new Error("Balance not enough");
  }
  for (let i = 0; i < nonOrdUtxos.length; i++) {
      const nonOrdUtxo = nonOrdUtxos[i];
      tx.addInput(nonOrdUtxo);
  }
  const tmpSum = tx.getTotalInput();
  const fee = await tx.calNetworkFee();
  const left = tmpSum - outputAmount - fee;
  if(left < UTXO_DUST) {
    throw new Error(
      `Balance not enough. Need ${satoshisToAmount(
        outputAmount + fee
      )} BTC as network fee, but only ${satoshisToAmount(tmpSum)} BTC.`
    );      
  }

  tx.outputs.find(o => o.value === 0)!.value  = left;

  // const unspent = tx.getUnspent();
  // if (unspent === 0) {
  //   throw new Error("Balance not enough to pay network fee.");
  // }

  const psbt = await tx.createSignedPsbt();
  if (dump) {
    tx.dumpTx(psbt);
  }

  return psbt;
}

export async function calculateMaxBtc({
  utxos,
  receivers,
  network,
  changeAddress,
  feeRate,
  data,
}: {
  utxos: UnspentOutput[];
  receivers: {
    address: string;
    amount?: number;
  }[];
  network: any;
  changeAddress: string;
  feeRate?: number;
  data?: string;
}) {
  const tx = new OrdTransaction(undefined, network, feeRate);
  tx.setChangeAddress(changeAddress);
  const to = receivers.find((v) => v.amount === undefined).address;
  if(!to) {
    throw new Error("No receiver found, please provide one receiver with undefined amount");
  }
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
    if(v.amount) {
      tx.addOutput(v.address, v.amount);
    } else {
      tx.addOutput(v.address, 0);
    }
  });

  if (data) tx.addOpReturnOutput(data);

  const outputAmount = tx.getTotalOutput();

  if (nonOrdUtxos.length === 0) {
    throw new Error("Balance not enough");
  }
  for (let i = 0; i < nonOrdUtxos.length; i++) {
      const nonOrdUtxo = nonOrdUtxos[i];
      tx.addInput(nonOrdUtxo);
  }
  const tmpSum = tx.getTotalInput();
  const fee = await tx.calNetworkFee();
  const left = tmpSum - outputAmount - fee;
  if(left < UTXO_DUST) {
    throw new Error(
      `At least ${satoshisToAmount(
        outputAmount + fee
      )} BTC.`
    );      
  }
  
  return fee
}

