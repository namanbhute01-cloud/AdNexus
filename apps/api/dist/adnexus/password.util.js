"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
const crypto_1 = require("crypto");
function hashPassword(password) {
    const salt = (0, crypto_1.randomBytes)(16).toString('hex');
    const derivedKey = (0, crypto_1.scryptSync)(password, salt, 64).toString('hex');
    return `scrypt$${salt}$${derivedKey}`;
}
function verifyPassword(password, storedHash) {
    const [scheme, salt, key] = storedHash.split('$');
    if (scheme !== 'scrypt' || !salt || !key) {
        return false;
    }
    const actual = (0, crypto_1.scryptSync)(password, salt, 64);
    const expected = Buffer.from(key, 'hex');
    return expected.length === actual.length && (0, crypto_1.timingSafeEqual)(expected, actual);
}
//# sourceMappingURL=password.util.js.map