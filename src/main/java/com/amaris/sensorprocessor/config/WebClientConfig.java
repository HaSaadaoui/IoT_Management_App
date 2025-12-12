package com.amaris.sensorprocessor.config;

import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import io.netty.handler.timeout.WriteTimeoutHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.filter.HiddenHttpMethodFilter;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Configuration
public class WebClientConfig {

    @Value("${api.base.url}")
    private String baseUrl; // ex: http://localhost:8081

    /**
     * WebClient générique pour les appels REST (JSON, etc.)
     */
    @Bean
    public WebClient webClient() {
        // Tampon raisonnable pour JSON (SSE n'utilise pas ce bean)
        ExchangeStrategies strategies = ExchangeStrategies.builder()
                .codecs(c -> c.defaultCodecs().maxInMemorySize(256 * 1024))
                .build();

        // Client Netty “standard” (timeouts raisonnables)
        HttpClient httpClient = HttpClient.create()
                .keepAlive(true)
                .responseTimeout(Duration.ofSeconds(60)) // OK pour REST
                .option(ChannelOption.SO_KEEPALIVE, true)
                // timeouts I/O basiques (ne s'appliquent pas aux flux SSE car autre bean dédié)
                .doOnConnected(conn -> conn
                        .addHandlerLast(new ReadTimeoutHandler(65, TimeUnit.SECONDS))
                        .addHandlerLast(new WriteTimeoutHandler(65, TimeUnit.SECONDS)));

        return WebClient.builder()
                .baseUrl(baseUrl)
                .exchangeStrategies(strategies)
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }

    /**
     * WebClient dédié aux SSE : pas de timeout de réponse, keep-alive, petit tampon,
     * et Accept: text/event-stream par défaut.
     */
    @Bean
    public WebClient webClientSse() {
        ExchangeStrategies sseStrategies = ExchangeStrategies.builder()
                .codecs(c -> c.defaultCodecs().maxInMemorySize(512 * 1024)) // petits chunks
                .build();

        // IMPORTANT: pas de responseTimeout -> Duration.ZERO = infini
        HttpClient httpClient = HttpClient.create()
                .keepAlive(true)
                .responseTimeout(Duration.ZERO) // laisse couler le flux indéfiniment
                .option(ChannelOption.SO_KEEPALIVE, true);

        return WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeaders(h -> h.setAccept(List.of(
                        MediaType.TEXT_EVENT_STREAM,
                        MediaType.APPLICATION_JSON
                )))
                .exchangeStrategies(sseStrategies)
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }

    @Bean
    public HiddenHttpMethodFilter hiddenHttpMethodFilter() {
        return new HiddenHttpMethodFilter();
    }

    @Configuration
    public static class WebConfig implements WebMvcConfigurer {
        @Override
        public void addResourceHandlers(ResourceHandlerRegistry registry) {

            registry.addResourceHandler("/uploads/**")
                    .addResourceLocations("file:uploads/");
            registry.addResourceHandler("/css/**")
                    .addResourceLocations("classpath:/static/css/");
            registry.addResourceHandler("/js/**")
                    .addResourceLocations("classpath:/static/js/");
            registry.addResourceHandler("/image/**")
                    .addResourceLocations("classpath:/static/image/");
        }
    }
}
