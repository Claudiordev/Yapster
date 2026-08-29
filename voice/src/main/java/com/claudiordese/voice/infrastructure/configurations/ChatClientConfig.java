package com.claudiordese.voice.infrastructure.configurations;

import com.claudiordese.voice.infrastructure.adapter.chat.ChatClient;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

@Configuration
public class ChatClientConfig {

    /**
     * {@code @LoadBalanced} makes Spring Cloud LoadBalancer resolve "chat" (below)
     * against Eureka instead of DNS -- same mechanism the router's gateway uses.
     */
    @Bean
    @LoadBalanced
    RestClient.Builder loadBalancedRestClientBuilder() {
        return RestClient.builder();
    }

    @Bean
    ChatClient chatClient(RestClient.Builder loadBalancedRestClientBuilder) {
        RestClient restClient = loadBalancedRestClientBuilder
                .baseUrl("http://chat/api/v1")
                .build();

        RestClientAdapter adapter = RestClientAdapter.create(restClient);

        return HttpServiceProxyFactory.builderFor(adapter).build().createClient(ChatClient.class);
    }
}
