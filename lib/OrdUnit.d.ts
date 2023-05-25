export declare class OrdUnit {
    satoshis: number;
    ords: {
        id: string;
        outputOffset: number;
        unitOffset: number;
    }[];
    constructor(satoshis: number, ords: {
        id: string;
        outputOffset: number;
        unitOffset: number;
    }[]);
    hasOrd(): boolean;
}
