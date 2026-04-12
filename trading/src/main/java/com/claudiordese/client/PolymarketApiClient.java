package com.claudiordese.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
public class PolymarketApiClient {

    private static final Logger logger = LoggerFactory.getLogger(PolymarketApiClient.class);
    private static final String CLOB_BASE = "https://clob.polymarket.com";

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public static HttpHeaders toHttpHeaders(Map<String, String> authHeaders) {
        HttpHeaders headers = new HttpHeaders();
        authHeaders.forEach(headers::set);
        return headers;
    }

    public boolean getNegRisk(String tokenId) throws Exception {
        ResponseEntity<String> resp = restTemplate.getForEntity(
                CLOB_BASE + "/neg-risk?token_id=" + tokenId, String.class);
        return objectMapper.readTree(resp.getBody()).get("neg_risk").asBoolean();
    }

    public int getFeeRate(String tokenId) throws Exception {
        ResponseEntity<String> resp = restTemplate.getForEntity(
                CLOB_BASE + "/fee-rate?token_id=" + tokenId, String.class);
        return objectMapper.readTree(resp.getBody()).get("base_fee").asInt();
    }

    public JsonNode getOrderBook(String tokenId) throws Exception {
        ResponseEntity<String> resp = restTemplate.getForEntity(
                CLOB_BASE + "/book?token_id=" + tokenId, String.class);
        return objectMapper.readTree(resp.getBody());
    }

    public ResponseEntity<String> getBalanceAllowance(String assetType, String tokenId, int sigType, HttpHeaders headers) {
        String url = CLOB_BASE + "/balance-allowance?asset_type=" + assetType + "&signature_type=" + sigType;
        if (tokenId != null) {
            url += "&token_id=" + tokenId;
        }
        return restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), String.class);
    }

    public ResponseEntity<String> updateBalanceAllowance(String body, HttpHeaders headers) {
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.exchange(
                CLOB_BASE + "/update-balance-allowance",
                HttpMethod.POST, new HttpEntity<>(body, headers), String.class);
    }

    public ResponseEntity<String> postOrder(String body, HttpHeaders headers) {
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.exchange(
                CLOB_BASE + "/order",
                HttpMethod.POST, new HttpEntity<>(body, headers), String.class);
    }

    public OrderResponse parseOrderResponse(String responseBody) throws Exception {
        JsonNode resp = objectMapper.readTree(responseBody);
        boolean success = resp.has("success") && resp.get("success").asBoolean();
        String orderId = resp.has("orderID") ? resp.get("orderID").asText() : null;
        String status = resp.has("status") ? resp.get("status").asText() : "unknown";
        String makingAmt = resp.has("makingAmount") ? resp.get("makingAmount").asText() : null;
        String takingAmt = resp.has("takingAmount") ? resp.get("takingAmount").asText() : null;
        String txHash = null;
        if (resp.has("transactionsHashes") && !resp.get("transactionsHashes").isEmpty()) {
            txHash = resp.get("transactionsHashes").get(0).asText();
        }
        return new OrderResponse(success, orderId, status, makingAmt, takingAmt, txHash);
    }

    /**
     * Extracts API credentials (apiKey, secret, passphrase) from a derive/create API key response.
     */
    public ApiCredentials extractApiCredentials(String responseBody) throws Exception {
        JsonNode json = objectMapper.readTree(responseBody);
        return new ApiCredentials(
                json.get("apiKey").asText(),
                json.get("secret").asText(),
                json.get("passphrase").asText()
        );
    }

    public ResponseEntity<String> deriveApiKey(HttpHeaders headers) {
        return restTemplate.exchange(
                CLOB_BASE + "/auth/derive-api-key",
                HttpMethod.GET, new HttpEntity<>(headers), String.class);
    }

    public ResponseEntity<String> createApiKey(HttpHeaders headers) {
        return restTemplate.exchange(
                CLOB_BASE + "/auth/api-key",
                HttpMethod.POST, new HttpEntity<>(headers), String.class);
    }

    public record OrderResponse(
            boolean success,
            String orderId,
            String status,
            String makingAmount,
            String takingAmount,
            String transactionHash
    ) {}

    public record ApiCredentials(String apiKey, String secret, String passphrase) {}
}
