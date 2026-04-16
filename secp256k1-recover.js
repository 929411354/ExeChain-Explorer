// secp256k1-recover.js - Module that exports only recoverPublicKey
import { secp256k1 } from '@noble/curves/secp256k1.js';

// Export only the recoverPublicKey function
export function recoverPublicKey(signature, message, opts) {
  return secp256k1.recoverPublicKey(signature, message, opts);
}
