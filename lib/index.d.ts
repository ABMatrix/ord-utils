import { UnspentOutput } from "./OrdTransaction";
export * from './utils';
export declare function createSendBTC({ utxos, toAddress, toAmount, wallet, network, changeAddress, receiverToPayFee, feeRate, dump, data, }: {
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
}): Promise<any>;
export declare function createSendMultiOrds({ utxos, toAddress, toOrdIds, receivers, wallet, network, changeAddress, feeRate, dump, data, }: {
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
}): Promise<any>;
export declare function createSendMultiBTC({ utxos, receivers, wallet, network, changeAddress, feeRate, dump, data, }: {
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
}): Promise<any>;
export declare function createSendMaxBTC({ utxos, receivers, wallet, network, changeAddress, feeRate, dump, data, }: {
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
}): Promise<any>;
export declare function calculateMaxBtc({ utxos, receivers, network, changeAddress, feeRate, data, }: {
    utxos: UnspentOutput[];
    receivers: {
        address: string;
        amount?: number;
    }[];
    network: any;
    changeAddress: string;
    feeRate?: number;
    data?: string;
}): Promise<number>;
