import sha3 from 'js-sha3';
import { secp256k1 } from '@noble/curves/secp256k1.js';
const { keccak_256 } = sha3;

const rawTx = '0xf86a80808252089442083092027564cede3e8b4b8dda16e69d37065389056bc75e2d6310000080824544a0892c82347ff42676dbe46a3d01201dcdda3d44f7fe3329c7214c76997a1c5a36a01d03c54954402f86bc90165c90e8c5a5d4865691ef6537ba78235d3041fdae74';

function hexToBytes(h) {
  h = h.replace(/^0x/, '');
  if (h.length % 2) h = '0' + h;
  return Uint8Array.from(h.match(/.{2}/g), b => parseInt(b, 16));
}

function bytesToHex(b) {
  return '0x' + Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

function rlpDecode(input, offset) {
  if (offset === undefined) offset = 0;
  var prefix = input[offset];
  if (prefix <= 0x7f) {
    return { decoded: input.slice(offset, offset + 1), consumed: 1 };
  } else if (prefix <= 0xb7) {
    var strLen = prefix - 0x80;
    return { decoded: input.slice(offset + 1, offset + 1 + strLen), consumed: 1 + strLen };
  } else if (prefix <= 0xbf) {
    var lenOfLen = prefix - 0xb7;
    var strLen = 0;
    for (var i = 0; i < lenOfLen; i++) {
      strLen = strLen * 256 + input[offset + 1 + i];
    }
    return { decoded: input.slice(offset + 1 + lenOfLen, offset + 1 + lenOfLen + strLen), consumed: 1 + lenOfLen + strLen };
  } else if (prefix <= 0xf7) {
    var listLen = prefix - 0xc0;
    var items = [];
    var totalConsumed = 1;
    var end = offset + 1 + listLen;
    var pos = offset + 1;
    while (pos < end) {
      var result = rlpDecode(input, pos);
      items.push(result.decoded);
      pos += result.consumed;
      totalConsumed += result.consumed;
    }
    return { decoded: items, consumed: totalConsumed };
  } else {
    var lenOfLen = prefix - 0xf7;
    var listLen = 0;
    for (var i = 0; i < lenOfLen; i++) {
      listLen = listLen * 256 + input[offset + 1 + i];
    }
    var items = [];
    var totalConsumed = 1 + lenOfLen;
    var end = offset + 1 + lenOfLen + listLen;
    var pos = offset + 1 + lenOfLen;
    while (pos < end) {
      var result = rlpDecode(input, pos);
      items.push(result.decoded);
      pos += result.consumed;
      totalConsumed += result.consumed;
    }
    return { decoded: items, consumed: totalConsumed };
  }
}

function rlpEncode(item) {
  if (item instanceof Uint8Array) {
    if (item.length === 0) return new Uint8Array([0x80]);
    if (item.length === 1 && item[0] < 0x80) return new Uint8Array([item[0]]);
    if (item.length <= 55) {
      var r = new Uint8Array(1 + item.length);
      r[0] = 0x80 + item.length;
      r.set(item, 1);
      return r;
    }
    var lenHex = item.length.toString(16);
    if (lenHex.length % 2) lenHex = '0' + lenHex;
    var lenBytes = hexToBytes(lenHex);
    var r = new Uint8Array(1 + lenBytes.length + item.length);
    r[0] = 0xb7 + lenBytes.length;
    r.set(lenBytes, 1);
    r.set(item, 1 + lenBytes.length);
    return r;
  }
  if (Array.isArray(item)) {
    var encoded = item.map(rlpEncode);
    var totalLen = encoded.reduce((s, e) => s + e.length, 0);
    if (totalLen <= 55) {
      var r = new Uint8Array(1 + totalLen);
      r[0] = 0xc0 + totalLen;
      var o = 1;
      for (var e of encoded) { r.set(e, o); o += e.length; }
      return r;
    }
    var lenHex = totalLen.toString(16);
    if (lenHex.length % 2) lenHex = '0' + lenHex;
    var lenBytes = hexToBytes(lenHex);
    var r = new Uint8Array(1 + lenBytes.length + totalLen);
    r[0] = 0xf7 + lenBytes.length;
    r.set(lenBytes, 1);
    var o = 1 + lenBytes.length;
    for (var e of encoded) { r.set(e, o); o += e.length; }
    return r;
  }
}

var bytes = hexToBytes(rawTx);
var fields = rlpDecode(bytes, 0).decoded;
var v_val = parseInt(bytesToHex(fields[6]), 16);
var chainId = Math.floor((v_val - 35) / 2);
var recoveryParam = (v_val - 35) % 2;

console.log('chainId:', chainId, 'recovery:', recoveryParam);

var signingData = rlpEncode([
  fields[0], fields[1], fields[2], fields[3], fields[4], fields[5],
  hexToBytes(chainId.toString(16).padStart(2, '0')),
  new Uint8Array([0]),
  new Uint8Array([0])
]);
var msgHash = keccak_256(signingData);
console.log('MsgHash:', '0x' + msgHash);

// Signature must be 65 bytes: r(32) + s(32) + recoveryBit(1)
var sig65 = new Uint8Array(65);
sig65.set(fields[7], 0);    // r
sig65.set(fields[8], 32);   // s
sig65[64] = recoveryParam;  // recovery bit

// msgHash is already hashed, pass prehash:false
var msgBytes = hexToBytes(msgHash);
var pubBytes = secp256k1.recoverPublicKey(sig65, msgBytes, { prehash: false, lowS: false });
var pubHash = keccak_256(pubBytes.slice(1));
var address = '0x' + pubHash.slice(-40);
console.log('Recovered:', address);
console.log('Expected:  ', '0x36960843290670c2cd0d567b534E818889B1040f');
console.log('Match:', address.toLowerCase() === '0x36960843290670c2cd0d567b534e818889b1040f');
