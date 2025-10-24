package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.LorawanSensorData;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Repository;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

@Repository
public class SensorLorawanDao {

    @Value("${lorawan.baseurl}")
    private String lorawanBaseUrl;

    @Value("${lorawan.service.token}")
    private String lorawanToken;

    private final WebClient.Builder webClientBuilder;

    private static final String AUTHORIZATION = "Authorization";
    private static final String BEARER = "Bearer";

    @Autowired
    public SensorLorawanDao(WebClient.Builder webClientBuilder) {
        this.webClientBuilder = webClientBuilder;
    }

    public void insertSensorInLorawan(String applicationId, LorawanSensorData body) {
        WebClient client = webClientBuilder.baseUrl(lorawanBaseUrl + "/applications").build();
        client.post()
            .uri(uriBuilder -> uriBuilder.path("/{app}/devices").build(applicationId))
            .header(AUTHORIZATION, BEARER + " " + lorawanToken)
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(body)
            .retrieve()
            .onStatus(
                status -> status.isError(),
                resp -> resp.bodyToMono(String.class).flatMap(msg ->
                    Mono.error(new WebClientResponseException(
                        "TTN error: " + msg,
                        resp.statusCode().value(), resp.statusCode().toString(),
                        null, null, null))
                )
            )
            .toBodilessEntity()
            .block();
    }

    public void deleteSensorInLorawan(String applicationId, String sensorId) {
        WebClient client = webClientBuilder.baseUrl(lorawanBaseUrl + "/applications").build();
        client.delete()
            .uri(uriBuilder -> uriBuilder.path("/{app}/devices/{dev}")
                .build(applicationId, sensorId))
            .header(AUTHORIZATION, BEARER + " " + lorawanToken)
            .retrieve()
            .onStatus(
                status -> status.isError(),
                resp -> resp.bodyToMono(String.class).flatMap(msg ->
                    Mono.error(new WebClientResponseException(
                        "TTN error: " + msg,
                        resp.statusCode().value(), resp.statusCode().toString(),
                        null, null, null))
                )
            )
            .toBodilessEntity()
            .block();
    }

    /**
     * Récupère tous les devices d'une application TTN
     * @param applicationId ID de l'application (ex: rpi-mantu-appli, lorawan-network-mantu)
     * @return JSON avec la liste des devices
     */
    public String fetchDevicesFromTTN(String applicationId) {
        try {
            WebClient client = webClientBuilder.baseUrl(lorawanBaseUrl).build();
            String response = client.get()
                .uri(uriBuilder -> uriBuilder
                    .path("/applications/{app}/devices")
                    .queryParam("limit", 200)
                    .build(applicationId))
                .header(AUTHORIZATION, BEARER + " " + lorawanToken)
                .retrieve()
                .bodyToMono(String.class)
                .block();
            
            return response != null ? response : "{}";
        } catch (Exception e) {
            return "{}";
        }
    }

    /**
     * Met à jour un sensor dans TTN (PATCH)
     * @param applicationId ID de l'application
     * @param sensorId ID du sensor
     * @param body Données à mettre à jour
     */
    public void updateSensorInLorawan(String applicationId, String sensorId, LorawanSensorData body) {
        WebClient client = webClientBuilder.baseUrl(lorawanBaseUrl + "/applications").build();
        client.patch()
            .uri(uriBuilder -> uriBuilder.path("/{app}/devices/{dev}")
                .build(applicationId, sensorId))
            .header(AUTHORIZATION, BEARER + " " + lorawanToken)
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(body)
            .retrieve()
            .onStatus(
                status -> status.isError(),
                resp -> resp.bodyToMono(String.class).flatMap(msg ->
                    Mono.error(new WebClientResponseException(
                        "TTN error: " + msg,
                        resp.statusCode().value(), resp.statusCode().toString(),
                        null, null, null))
                )
            )
            .toBodilessEntity()
            .block();
    }

}
