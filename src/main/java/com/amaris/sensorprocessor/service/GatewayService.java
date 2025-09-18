package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.constant.Constants;
import com.amaris.sensorprocessor.entity.Gateway;
import com.amaris.sensorprocessor.entity.MonitoringGatewayData;
import com.amaris.sensorprocessor.exception.CustomException;
import com.amaris.sensorprocessor.repository.GatewayDao;
import com.amaris.sensorprocessor.util.LoggerUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.validation.BindingResult;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Service
public class GatewayService {

    private final Logger logger = LoggerFactory.getLogger(this.getClass());

    private final GatewayDao gatewayDao;
    private final WebClient webClient;

    @Autowired
    public GatewayService(GatewayDao gatewayDao, WebClient webClient) {
        this.gatewayDao = gatewayDao;
        this.webClient = webClient;
    }

    public List<Gateway> getAllGateways() {
        try {
            return gatewayDao.findAllGateways();
        } catch (Exception e) {
            LoggerUtil.logError(e, null);
            return Collections.emptyList();
        }
    }

    public Optional<Gateway> findById(String gatewayId) {
        try {
            return gatewayDao.findGatewayById(gatewayId);
        } catch (Exception e) {
            LoggerUtil.logError(e, gatewayId);
            return Optional.empty();
        }
    }

    public void saveGatewayInDatabase(Gateway gateway, BindingResult bindingResult) {
        try {
            if (gatewayDao.findGatewayById(gateway.getGatewayId()).isPresent()) {
                LoggerUtil.logWithBindingObject(bindingResult, Constants.GATEWAY_ID_EXISTS, gateway.getGatewayId(), Constants.BINDING_GATEWAY_ID);
            }
//            gateway.setCreatedAt(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"))); // UNIQUEMENT POUR LES TESTS SANS LORAWAN
            gatewayDao.insertGatewayInDatabase(gateway);
        } catch (Exception e) {
            LoggerUtil.logWithBindingObjectError(bindingResult, e, Constants.DATABASE_PROBLEM, null, Constants.BINDING_DATABASE_PROBLEM);
        }
    }

    public void deleteGatewayInDatabase(String gatewayId, BindingResult bindingResult) {
        try {
            int deleteLigne = gatewayDao.deleteGatewayById(gatewayId);
            if (deleteLigne == 0) {
                LoggerUtil.logWithBindingObject(bindingResult, Constants.GATEWAY_NOT_FOUND, gatewayId, Constants.BINDING_GATEWAY_ID);
            }
        } catch (Exception e) {
            LoggerUtil.logWithBindingObjectError(bindingResult, e, Constants.DATABASE_PROBLEM, null, Constants.BINDING_DATABASE_PROBLEM);
        }
    }

    public Gateway searchGatewayById(String gatewayId) {
        try {
            return gatewayDao.findGatewayById(gatewayId).orElse(null);
        } catch (Exception e) {
            LoggerUtil.logError(e, gatewayId);
            throw new CustomException("database Problem");
        }
    }

    public void updateGatewayInDatabase(Gateway gateway, BindingResult bindingResult) {
        try {
            int rowsUpdated = gatewayDao.updateGatewayInDatabase(gateway);
            if (rowsUpdated == 0) {
                LoggerUtil.logWithBindingObject(bindingResult, Constants.GATEWAY_NOT_FOUND, gateway.getGatewayId(), Constants.BINDING_GATEWAY_ID);
            }
        } catch (Exception e) {
            LoggerUtil.logWithBindingObjectError(bindingResult, e, Constants.DATABASE_PROBLEM, null, Constants.BINDING_LORAWAN_PROBLEM);
        }
    }

    /**
     * Récupère un flux SSE (Server-Sent Events) contenant les données de monitoring
     * en temps réel d'une gateway spécifique, à partir de son ID et de son adresse IP.
     * La méthode .bodyToFlux(MonitoringGatewayData.class) convertit directement le JSON en objets Java.
     *
     * @param gatewayId l'identifiant unique de la gateway
     * @param ipAddress l'adresse IP de la gateway cible
     * @param threadId l'id du thread à créer dans l'API REST
     * @return un Flux de MonitoringGatewayData émis en continu via SSE
     */
    public Flux<MonitoringGatewayData> getMonitoringData(String gatewayId, String ipAddress, String threadId) {
        return webClient.get()
            .uri(uriBuilder -> uriBuilder
                .path("/api/monitoring/gateway/{id}")
                .queryParam("ip", ipAddress)
                .queryParam("threadId", threadId)
                .build(gatewayId))
            .accept(MediaType.TEXT_EVENT_STREAM)
            .retrieve()
            .bodyToFlux(MonitoringGatewayData.class)
            .doOnError(error -> {
                logger.error("Erreur lors de la récupération des données de monitoring", error);
                System.out.println("\u001B[31m" + "Erreur lors de la récupération des données de monitoring : " + error.getMessage() + "\u001B[0m");
            }
        );
    }

    public void stopMonitoring(String gatewayId, String threadId) {
        webClient.get()
            .uri(uriBuilder -> uriBuilder
                .path("/api/monitoring/gateway/stop/{id}")
                .queryParam("threadId", threadId)
                .build(gatewayId))
            .retrieve()
            .toBodilessEntity()
            .doOnSuccess(response -> logger.info("Monitoring stopped for gateway {}", threadId))
            .doOnError(error -> logger.error("Erreur lors de l'arrêt du monitoring pour gateway {}", threadId, error))
            .subscribe();
    }

}
