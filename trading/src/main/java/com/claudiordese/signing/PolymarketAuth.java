package com.claudiordese.signing;

import com.claudiordese.utils.CryptoUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.web3j.crypto.ECKeyPair;
import org.web3j.crypto.Hash;
import org.web3j.crypto.Keys;
import org.web3j.utils.Numeric;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Component
public class PolymarketAuth {

    private static final Logger logger = LoggerFactory.getLogger(PolymarketAuth.class);

    private static final String DOMAIN_NAME = "ClobAuthDomain";
    private static final String DOMAIN_VERSION = "1";
    private static final BigInteger CHAIN_ID = BigInteger.valueOf(137);
    private static final String ATTESTATION_MESSAGE = "This message attests that I control the given wallet";

    private static final byte[] EIP712_DOMAIN_TYPEHASH = Hash.sha3(
            "EIP712Domain(string name,string version,uint256 chainId)".getBytes(StandardCharsets.UTF_8));
    private static final byte[] CLOB_AUTH_TYPEHASH = Hash.sha3(
            "ClobAuth(address address,string timestamp,uint256 nonce,string message)".getBytes(StandardCharsets.UTF_8));

    private ECKeyPair keyPair;
    private String address;

    // L2 credentials (set after deriving/creating API key)
    private String apiKey;
    private String secret;
    private String passphrase;

    public PolymarketAuth(@Value("${polymarket.private-key}") String privateKeyHex) {
        if (privateKeyHex != null && !privateKeyHex.isBlank()) {
            String cleanKey = privateKeyHex.startsWith("0x") ? privateKeyHex.substring(2) : privateKeyHex;
            this.keyPair = ECKeyPair.create(new BigInteger(cleanKey, 16));
            this.address = Keys.toChecksumAddress("0x" + Keys.getAddress(keyPair.getPublicKey()));
            logger.info("PolymarketAuth configured for address: {}", address);
        }
    }

    public boolean isConfigured() {
        return keyPair != null;
    }

    public boolean hasApiCredentials() {
        return apiKey != null && secret != null && passphrase != null;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiCredentials(String apiKey, String secret, String passphrase) {
        this.apiKey = apiKey;
        this.secret = secret;
        this.passphrase = passphrase;
        logger.info("L2 API credentials set for address: {}", address);
    }

    // ---- L1 Authentication (EIP-712) ----

    public Map<String, String> buildL1Headers() {
        return buildL1Headers(0);
    }

    public Map<String, String> buildL1Headers(long nonce) {
        if (!isConfigured()) throw new IllegalStateException("Private key not configured.");
        String timestamp = String.valueOf(System.currentTimeMillis() / 1000);
        String signature = signClobAuth(timestamp, nonce);
        return Map.of(
                "POLY_ADDRESS", address,
                "POLY_SIGNATURE", signature,
                "POLY_TIMESTAMP", timestamp,
                "POLY_NONCE", String.valueOf(nonce)
        );
    }

    // ---- L2 Authentication (HMAC-SHA256) ----

    public Map<String, String> buildL2Headers(String method, String requestPath) {
        return buildL2Headers(method, requestPath, null);
    }

    public Map<String, String> buildL2Headers(String method, String requestPath, String body) {
        if (!hasApiCredentials()) throw new IllegalStateException("API credentials not set. Derive them first.");
        String timestamp = String.valueOf(System.currentTimeMillis() / 1000);
        String signature = buildHmacSignature(timestamp, method, requestPath, body);

        Map<String, String> headers = new HashMap<>();
        headers.put("POLY_ADDRESS", address);
        headers.put("POLY_SIGNATURE", signature);
        headers.put("POLY_TIMESTAMP", timestamp);
        headers.put("POLY_API_KEY", apiKey);
        headers.put("POLY_PASSPHRASE", passphrase);
        return headers;
    }

    private String buildHmacSignature(String timestamp, String method, String requestPath, String body) {
        try {
            byte[] secretBytes = Base64.getUrlDecoder().decode(secret);
            String message = timestamp + method + requestPath;
            if (body != null && !body.isEmpty()) {
                message += body;
            }

            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secretBytes, "HmacSHA256"));
            byte[] hmacBytes = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));

            return Base64.getUrlEncoder().encodeToString(hmacBytes);
        } catch (Exception e) {
            throw new RuntimeException("Failed to build HMAC signature", e);
        }
    }

    // ---- EIP-712 signing ----

    public String signClobAuth(String timestamp, long nonce) {
        byte[] domainSeparator = buildDomainSeparator();
        byte[] structHash = buildStructHash(timestamp, nonce);
        return CryptoUtils.signEip712(domainSeparator, structHash, keyPair);
    }

    private byte[] buildDomainSeparator() {
        byte[] nameHash = Hash.sha3(DOMAIN_NAME.getBytes(StandardCharsets.UTF_8));
        byte[] versionHash = Hash.sha3(DOMAIN_VERSION.getBytes(StandardCharsets.UTF_8));
        byte[] chainIdBytes = CryptoUtils.padLeft32(CHAIN_ID.toByteArray());

        byte[] data = new byte[32 * 4];
        System.arraycopy(EIP712_DOMAIN_TYPEHASH, 0, data, 0, 32);
        System.arraycopy(nameHash, 0, data, 32, 32);
        System.arraycopy(versionHash, 0, data, 64, 32);
        System.arraycopy(chainIdBytes, 0, data, 96, 32);

        return Hash.sha3(data);
    }

    private byte[] buildStructHash(String timestamp, long nonce) {
        byte[] addressBytes = CryptoUtils.padLeft32(Numeric.hexStringToByteArray(address));
        byte[] timestampHash = Hash.sha3(timestamp.getBytes(StandardCharsets.UTF_8));
        byte[] nonceBytes = CryptoUtils.padLeft32(BigInteger.valueOf(nonce).toByteArray());
        byte[] messageHash = Hash.sha3(ATTESTATION_MESSAGE.getBytes(StandardCharsets.UTF_8));

        byte[] data = new byte[32 * 5];
        System.arraycopy(CLOB_AUTH_TYPEHASH, 0, data, 0, 32);
        System.arraycopy(addressBytes, 0, data, 32, 32);
        System.arraycopy(timestampHash, 0, data, 64, 32);
        System.arraycopy(nonceBytes, 0, data, 96, 32);
        System.arraycopy(messageHash, 0, data, 128, 32);

        return Hash.sha3(data);
    }

}
