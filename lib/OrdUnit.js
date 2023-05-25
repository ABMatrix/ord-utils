"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdUnit = void 0;
class OrdUnit {
    constructor(satoshis, ords) {
        this.satoshis = satoshis;
        this.ords = ords;
    }
    hasOrd() {
        return this.ords.length > 0;
    }
}
exports.OrdUnit = OrdUnit;
