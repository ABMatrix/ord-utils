/// <reference types="node" />
import * as bitcoin from "bitcoinjs-lib";
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
export declare function utxoToInput(utxo: UnspentOutput, publicKey: Buffer): TxInput;
export declare class OrdTransaction {
    private inputs;
    outputs: TxOutput[];
    opReturnOutputs: OpReturnOutput[];
    private changeOutputIndex;
    private wallet;
    changedAddress: string;
    private network;
    private feeRate;
    private pubkey;
    constructor(wallet: any, network: any, pubkey: string, feeRate?: number);
    initBitcoin(): Promise<void>;
    setChangeAddress(address: string): void;
    addInput(utxo: UnspentOutput): void;
    getTotalInput(): number;
    getTotalOutput(): number;
    getUnspent(): number;
    isEnoughFee(): Promise<boolean>;
    calNetworkFee(): Promise<number>;
    addOutput(address: string, value: number): void;
    addOpRetunOutput(data: string): void;
    getOutput(index: number): TxOutput;
    addChangeOutput(value: number): void;
    getChangeOutput(): TxOutput;
    getChangeAmount(): number;
    removeChangeOutput(): void;
    removeRecentOutputs(count: number): void;
    createSignedPsbt(): Promise<bitcoin.Psbt>;
    generate(autoAdjust: boolean): Promise<{
        fee: number;
        rawtx: string;
        toSatoshis: number;
        estimateFee: number;
    }>;
    dumpTx(psbt: any): Promise<void>;
}
export {};
