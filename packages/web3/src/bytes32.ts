import { bytesToHex, hexToString, stringToBytes, trim } from "viem";

/** Encodes a UTF-8 string into a right-padded bytes32 word, truncating at 32 bytes. */
export const stringToBytes32 = (value: string): `0x${string}` =>
  bytesToHex(stringToBytes(value).slice(0, 32), { size: 32 });

const NULL_BYTE = String.fromCharCode(0);

/** Decodes a bytes32 word back to a string, stripping the zero padding. */
export const bytes32ToString = (value: `0x${string}`): string =>
  hexToString(trim(value)).replaceAll(NULL_BYTE, "");
