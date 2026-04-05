package com.claudiordese.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class MarketResolver {

    private static final Logger logger = LoggerFactory.getLogger(MarketResolver.class);
    private static final String GAMMA_API = "https://gamma-api.polymarket.com";

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Resolves the Up and Down token IDs for a BTC 5-minute block.
     * @param blockId the block start timestamp in seconds (e.g. 1772737500)
     * @return MarketTokens with upTokenId and downTokenId, or null if not found
     */
    public MarketTokens resolve(long blockId) {
        try {
            String slug = "btc-updown-5m-" + blockId;
            String url = GAMMA_API + "/events?slug=" + slug;
            String body = restTemplate.getForObject(url, String.class);
            JsonNode events = objectMapper.readTree(body);

            if (events == null || events.isEmpty()) {
                logger.warn("No event found for slug: {}", slug);
                return null;
            }

            JsonNode event = events.get(0);
            JsonNode markets = event.get("markets");
            if (markets == null || markets.isEmpty()) {
                logger.warn("No markets found for slug: {}", slug);
                return null;
            }

            JsonNode tokenIds = objectMapper.readTree(markets.get(0).get("clobTokenIds").asText());
            String upTokenId = tokenIds.get(0).asText();
            String downTokenId = tokenIds.get(1).asText();

            logger.info("Resolved {}: Up={}, Down={}", slug, upTokenId, downTokenId);
            return new MarketTokens(blockId, upTokenId, downTokenId);
        } catch (Exception e) {
            logger.error("Failed to resolve market for blockId {}: {}", blockId, e.getMessage());
            return null;
        }
    }

    /**
     * Fetches the full event JSON for a block to extract target price, end date, etc.
     */
    public JsonNode resolveEvent(long blockId) {
        try {
            String slug = "btc-updown-5m-" + blockId;
            String url = GAMMA_API + "/events?slug=" + slug;
            String body = restTemplate.getForObject(url, String.class);
            JsonNode events = objectMapper.readTree(body);

            if (events == null || events.isEmpty()) return null;

            JsonNode event = events.get(0);
            logger.info("Event for block {}: {}", blockId, event);
            return event;
        } catch (Exception e) {
            logger.error("Failed to fetch event for blockId {}: {}", blockId, e.getMessage());
            return null;
        }
    }

    public record MarketTokens(long blockId, String upTokenId, String downTokenId) {}
}
