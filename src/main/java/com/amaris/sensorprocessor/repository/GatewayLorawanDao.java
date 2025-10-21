package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.LorawanGatewayData;
import com.amaris.sensorprocessor.entity.LorawanGatewayUpdateData;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;
import org.springframework.web.reactive.function.client.WebClient;

@Repository
public class GatewayLorawanDao {

    @Value("${lorawan.baseurlCreate}")
    private String lorawanBaseUrlCreate;

    @Value("${lorawan.baseurl}")
    private String lorawanBaseUrl;

    @Value("${lorawan.service.token}")
    private String lorawanToken;

    private final WebClient.Builder webClientBuilder;

    private static final String AUTHORIZATION = "Authorization";
    private static final String BEARER = "Bearer";

    @Autowired
    public GatewayLorawanDao(WebClient.Builder webClientBuilder) {
        this.webClientBuilder = webClientBuilder;
    }

    public String insertGatewayInLorawan(LorawanGatewayData lorawanGatewayData) {
        return webClientBuilder.build()
            .post()
            .uri(lorawanBaseUrlCreate)
            .header(AUTHORIZATION, BEARER + " " + lorawanToken)
            .bodyValue(lorawanGatewayData)
            .retrieve()
            .bodyToMono(String.class)
            .block();
    }

    public void deleteGatewayInLorawan(String gatewayId) {
        webClientBuilder.build()
            .delete()
            .uri(lorawanBaseUrl + "/gateways/" + gatewayId)
            .header(AUTHORIZATION, BEARER + " " + lorawanToken)
            .retrieve()
            .toBodilessEntity()
            .block();
    }

    public void updateGatewayInLorawan(LorawanGatewayUpdateData updateData, String gatewayId) {
        webClientBuilder.build()
            .put()
            .uri(lorawanBaseUrl + "/gateways/" + gatewayId)
            .header(AUTHORIZATION, BEARER + " " + lorawanToken)
            .bodyValue(updateData)
            .retrieve()
            .toBodilessEntity()
            .block();
    }

}
