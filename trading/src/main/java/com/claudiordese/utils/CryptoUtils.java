package com.claudiordese.utils;

import org.web3j.crypto.ECKeyPair;
import org.web3j.crypto.Hash;
import org.web3j.crypto.Sign;
import org.web3j.utils.Numeric;

/**
 * Shared cryptographic utility methods for EIP-712 signing and byte manipulation.
 */
public final class CryptoUtils {

    private CryptoUtils() {}

    /**
     * Pads a byte array to 32 bytes (left-padded with zeros), or truncates if longer.
     * Standard for EVM uint256/address encoding.
     */
    public static byte[] padLeft32(byte[] input) {
        if (input.length == 32) return input;
        byte[] padded = new byte[32];
        if (input.length > 32) {
            System.arraycopy(input, input.length - 32, padded, 0, 32);
        } else {
            System.arraycopy(input, 0, padded, 32 - input.length, input.length);
        }
        return padded;
    }

    /**
     * Encodes and signs an EIP-712 typed message: "\x19\x01" || domainSeparator || structHash.
     * @return hex-encoded 65-byte signature (r, s, v)
     */
    public static String signEip712(byte[] domainSeparator, byte[] structHash, ECKeyPair keyPair) {
        byte[] encoded = new byte[2 + 32 + 32];
        encoded[0] = 0x19;
        encoded[1] = 0x01;
        System.arraycopy(domainSeparator, 0, encoded, 2, 32);
        System.arraycopy(structHash, 0, encoded, 34, 32);

        byte[] digest = Hash.sha3(encoded);
        Sign.SignatureData sig = Sign.signMessage(digest, keyPair, false);

        byte[] sigBytes = new byte[65];
        System.arraycopy(sig.getR(), 0, sigBytes, 0, 32);
        System.arraycopy(sig.getS(), 0, sigBytes, 32, 32);
        sigBytes[64] = sig.getV()[0];

        return Numeric.toHexString(sigBytes);
    }
}
