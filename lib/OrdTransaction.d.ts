/// <reference types="node" />
import * as bitcoin from "bitcoinjs-lib-mpc";
interface TxInput {
    data: {
        hash: string;
        index: number;
        witnessUtxo: {
            value: number;
            script: Buffer;
        };
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
        rune: string;
    }[];
    tapMerkelRoot?: string;
    tapLeafScript?: any;
}
export declare enum AddressType {
    P2PKH = 0,
    P2WPKH = 1,
    P2TR = 2,
    P2SH_P2WPKH = 3,
    M44_P2WPKH = 4,
    M44_P2TR = 5
}
export declare const toXOnly: (pubKey: Buffer) => Buffer;
export declare function utxoToInput(utxo: UnspentOutput): TxInput;
export declare class OrdTransaction {
    inputs: TxInput[];
    outputs: (TxOutput | OpReturnOutput)[];
    private changeOutputIndex;
    private wallet;
    changedAddress: string;
    private network;
    private feeRate;
    private pubkey;
    constructor(wallet: any, network: any, feeRate?: number);
    initBitcoin(): Promise<void>;
    setChangeAddress(address: string): void;
    addInput(utxo: UnspentOutput): void;
    getTotalInput(): number;
    getTotalOutput(): number;
    getUnspent(): number;
    isEnoughFee(): Promise<boolean>;
    calNetworkFee(): Promise<number>;
    addOutput(address: string, value: number): void;
    addOpReturnOutput(data: string): void;
    addRunestone(data: string): void;
    getOutput(index: number): TxOutput | OpReturnOutput;
    addChangeOutput(value: number): void;
    getChangeOutput(): TxOutput | OpReturnOutput;
    getChangeAmount(): number;
    removeChangeOutput(): void;
    removeRecentOutputs(count: number): void;
    createSignedPsbt(txInfo?: InternalTransaction): Promise<bitcoin.Psbt>;
    createPsbt(): Promise<bitcoin.Psbt>;
    generate(autoAdjust: boolean): Promise<{
        fee: number;
        rawtx: string;
        toSatoshis: number;
        estimateFee: number;
    }>;
    dumpTx(psbt: any): Promise<void>;
}
export {};
