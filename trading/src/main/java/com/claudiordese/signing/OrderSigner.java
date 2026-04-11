package com.claudiordese.signing;

import org.web3j.crypto.ECKeyPair;
import org.web3j.crypto.Hash;
import org.web3j.crypto.Keys;
import org.web3j.crypto.Sign;
import org.web3j.utils.Numeric;

import com.claudiordese.utils.MathUtils;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Signs Polymarket CTF Exchange orders using EIP-712.
 */
public class OrderSigner {

    // Exchange contract on Polygon mainnet
    private static final String EXCHANGE_ADDRESS = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
    private static final String NEG_RISK_EXCHANGE = "0xC5d563A36AE78145C45a50134d48A1215220f80a";
    private static final String ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    private static final int CHAIN_ID = 137;

    // Side constants
    public static final int BUY = 0;
    public static final int SELL = 1;

    // Signature type constants
    public static final int EOA = 0;
    public static final int POLY_PROXY = 1;

    // EIP-712 type hashes
    private static final byte[] DOMAIN_TYPEHASH = Hash.sha3(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)".getBytes(StandardCharsets.UTF_8));
    private static final byte[] ORDER_TYPEHASH = Hash.sha3(
            "Order(uint256 salt,address maker,address signer,address taker,uint256 tokenId,uint256 makerAmount,uint256 takerAmount,uint256 expiration,uint256 nonce,uint256 feeRateBps,uint8 side,uint8 signatureType)".getBytes(StandardCharsets.UTF_8));

    private final ECKeyPair keyPair;
    private final String signerAddress;
    private final String makerAddress; // proxy address or signer address
    private final int signatureType;

    private final SecureRandom random = new SecureRandom();

    public OrderSigner(String privateKeyHex, String proxyAddress) {
        String cleanKey = privateKeyHex.startsWith("0x") ? privateKeyHex.substring(2) : privateKeyHex;
        this.keyPair = ECKeyPair.create(new BigInteger(cleanKey, 16));
        this.signerAddress = Keys.toChecksumAddress("0x" + Keys.getAddress(keyPair.getPublicKey()));

        if (proxyAddress != null && !proxyAddress.isBlank()) {
            this.makerAddress = Keys.toChecksumAddress(proxyAddress);
            this.signatureType = POLY_PROXY;
        } else {
            this.makerAddress = signerAddress;
            this.signatureType = EOA;
        }
    }

    public int getSignatureType() {
        return signatureType;
    }

    /**
     * Creates a signed market BUY order.
     * @param tokenId the CLOB token ID for the outcome
     * @param amount USDC amount to spend (e.g. 1.0 for $1)
     * @param price price per share (e.g. 0.51)
     * @param feeRateBps fee rate in basis points
     * @param negRisk whether this is a neg-risk market
     * @return map representing the signed order JSON
     */
    public Map<String, Object> buildSignedMarketBuyOrder(String tokenId, double amount, double price, int feeRateBps, boolean negRisk) {
        // For market BUY: makerAmount = USDC spent, takerAmount = shares received
        double rawMakerAmt = MathUtils.roundDown(amount, 2);
        double rawTakerAmt = rawMakerAmt / MathUtils.roundNormal(price, 2);
        rawTakerAmt = MathUtils.roundDown(rawTakerAmt, 4);

        long makerAmount = MathUtils.toTokenDecimals(rawMakerAmt);
        long takerAmount = MathUtils.toTokenDecimals(rawTakerAmt);

        return buildSignedOrder(tokenId, makerAmount, takerAmount, BUY, feeRateBps, negRisk);
    }

    /**
     * Creates a signed market SELL order.
     * @param tokenId the CLOB token ID for the outcome
     * @param shares number of shares to sell
     * @param price price per share (best bid)
     * @param feeRateBps fee rate in basis points
     * @param negRisk whether this is a neg-risk market
     * @return map representing the signed order JSON
     */
    public Map<String, Object> buildSignedMarketSellOrder(String tokenId, double shares, double price, int feeRateBps, boolean negRisk) {
        // For market SELL: makerAmount = shares to sell, takerAmount = USDC to receive
        double rawMakerAmt = MathUtils.roundDown(shares, 4);
        double rawTakerAmt = rawMakerAmt * MathUtils.roundNormal(price, 2);
        rawTakerAmt = MathUtils.roundDown(rawTakerAmt, 2);

        long makerAmount = MathUtils.toTokenDecimals(rawMakerAmt);
        long takerAmount = MathUtils.toTokenDecimals(rawTakerAmt);

        return buildSignedOrder(tokenId, makerAmount, takerAmount, SELL, feeRateBps, negRisk);
    }

    private Map<String, Object> buildSignedOrder(String tokenId, long makerAmount, long takerAmount, int side, int feeRateBps, boolean negRisk) {
        long salt = Math.abs(random.nextLong());

        String exchange = negRisk ? NEG_RISK_EXCHANGE : EXCHANGE_ADDRESS;

        byte[] domainSeparator = buildDomainSeparator(exchange);
        byte[] structHash = buildOrderStructHash(
                salt, makerAddress, signerAddress, ZERO_ADDRESS,
                new BigInteger(tokenId), makerAmount, takerAmount,
                0, 0, feeRateBps, side, signatureType);

        // EIP-712: "\x19\x01" || domainSeparator || structHash
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

        String signature = Numeric.toHexString(sigBytes);

        // Build the order JSON matching Polymarket's expected format
        Map<String, Object> order = new LinkedHashMap<>();
        order.put("salt", salt);
        order.put("maker", makerAddress);
        order.put("signer", signerAddress);
        order.put("taker", ZERO_ADDRESS);
        order.put("tokenId", tokenId);
        order.put("makerAmount", String.valueOf(makerAmount));
        order.put("takerAmount", String.valueOf(takerAmount));
        order.put("expiration", "0");
        order.put("nonce", "0");
        order.put("feeRateBps", String.valueOf(feeRateBps));
        order.put("side", side == BUY ? "BUY" : "SELL");
        order.put("signatureType", signatureType);
        order.put("signature", signature);

        return order;
    }

    private byte[] buildDomainSeparator(String exchangeAddress) {
        byte[] nameHash = Hash.sha3("Polymarket CTF Exchange".getBytes(StandardCharsets.UTF_8));
        byte[] versionHash = Hash.sha3("1".getBytes(StandardCharsets.UTF_8));
        byte[] chainIdBytes = padLeft32(BigInteger.valueOf(CHAIN_ID).toByteArray());
        byte[] contractBytes = padLeft32(Numeric.hexStringToByteArray(exchangeAddress));

        byte[] data = new byte[32 * 5];
        System.arraycopy(DOMAIN_TYPEHASH, 0, data, 0, 32);
        System.arraycopy(nameHash, 0, data, 32, 32);
        System.arraycopy(versionHash, 0, data, 64, 32);
        System.arraycopy(chainIdBytes, 0, data, 96, 32);
        System.arraycopy(contractBytes, 0, data, 128, 32);

        return Hash.sha3(data);
    }

    private byte[] buildOrderStructHash(long salt, String maker, String signer, String taker,
                                         BigInteger tokenId, long makerAmount, long takerAmount,
                                         long expiration, long nonce, int feeRateBps, int side, int sigType) {
        // 12 fields + typehash = 13 * 32 bytes
        byte[] data = new byte[32 * 13];
        int offset = 0;

        System.arraycopy(ORDER_TYPEHASH, 0, data, offset, 32); offset += 32;
        System.arraycopy(padLeft32(BigInteger.valueOf(salt).toByteArray()), 0, data, offset, 32); offset += 32;
        System.arraycopy(padLeft32(Numeric.hexStringToByteArray(maker)), 0, data, offset, 32); offset += 32;
        System.arraycopy(padLeft32(Numeric.hexStringToByteArray(signer)), 0, data, offset, 32); offset += 32;
        System.arraycopy(padLeft32(Numeric.hexStringToByteArray(taker)), 0, data, offset, 32); offset += 32;
        System.arraycopy(padLeft32(tokenId.toByteArray()), 0, data, offset, 32); offset += 32;
        System.arraycopy(padLeft32(BigInteger.valueOf(makerAmount).toByteArray()), 0, data, offset, 32); offset += 32;
        System.arraycopy(padLeft32(BigInteger.valueOf(takerAmount).toByteArray()), 0, data, offset, 32); offset += 32;
        System.arraycopy(padLeft32(BigInteger.valueOf(expiration).toByteArray()), 0, data, offset, 32); offset += 32;
        System.arraycopy(padLeft32(BigInteger.valueOf(nonce).toByteArray()), 0, data, offset, 32); offset += 32;
        System.arraycopy(padLeft32(BigInteger.valueOf(feeRateBps).toByteArray()), 0, data, offset, 32); offset += 32;
        System.arraycopy(padLeft32(BigInteger.valueOf(side).toByteArray()), 0, data, offset, 32); offset += 32;
        System.arraycopy(padLeft32(BigInteger.valueOf(sigType).toByteArray()), 0, data, offset, 32);

        return Hash.sha3(data);
    }

    private static byte[] padLeft32(byte[] input) {
        if (input.length == 32) return input;
        byte[] padded = new byte[32];
        if (input.length > 32) {
            System.arraycopy(input, input.length - 32, padded, 0, 32);
        } else {
            System.arraycopy(input, 0, padded, 32 - input.length, input.length);
        }
        return padded;
    }
}
