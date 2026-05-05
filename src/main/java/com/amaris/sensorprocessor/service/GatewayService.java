package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.constant.Constants;
import com.amaris.sensorprocessor.entity.Gateway;
import com.amaris.sensorprocessor.entity.GatewayData;
import com.amaris.sensorprocessor.entity.GatewayValueType;
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

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GatewayService {

    private final Logger logger = LoggerFactory.getLogger(this.getClass());

    private final GatewayDao gatewayDao;
    private final GatewayDataService gatewayDataService;
    private final WebClient webClient;
    private final Map<String, Instant> gatewayRestartingUntil = new ConcurrentHashMap<>();

    private static final Duration GATEWAY_RESTART_EXPECTED_DURATION = Duration.ofMinutes(3);

    @Autowired
    public GatewayService(GatewayDao gatewayDao, GatewayDataService gatewayDataService, WebClient webClient) {
        this.gatewayDao = gatewayDao;
        this.gatewayDataService = gatewayDataService;
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

    public List<Gateway> findByBuildingId(Integer buildingId) {
        return gatewayDao.findGatewaysByBuildingId(buildingId);
    }

    public void saveGatewayInDatabase(Gateway gateway, BindingResult bindingResult) {
        try {
            if (gatewayDao.findGatewayById(gateway.getGatewayId()).isPresent()) {
                LoggerUtil.logWithBindingObject(bindingResult, Constants.GATEWAY_ID_EXISTS, gateway.getGatewayId(), Constants.BINDING_GATEWAY_ID);
            }
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
            .doOnNext(data -> {
                gatewayDataService.storeMonitoringData(gatewayId, data);
                clearGatewayRestarting(gatewayId);
            })
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

    public String restartGateway(String gatewayId, String ipAddress) {
        markGatewayRestarting(gatewayId);
        try {
            return webClient.post()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/monitoring/gateway/restart/{id}")
                            .queryParam("ip", ipAddress)
                            .build(gatewayId))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
        } catch (RuntimeException e) {
            clearGatewayRestarting(gatewayId);
            throw e;
        }
    }

    public boolean isGatewayRestarting(String gatewayId) {
        Instant until = gatewayRestartingUntil.get(gatewayId);
        if (until == null) {
            return false;
        }
        if (Instant.now().isAfter(until)) {
            gatewayRestartingUntil.remove(gatewayId);
            return false;
        }
        return true;
    }

    public long getGatewayRestartRemainingSeconds(String gatewayId) {
        Instant until = gatewayRestartingUntil.get(gatewayId);
        if (until == null) {
            return 0;
        }
        long seconds = Duration.between(Instant.now(), until).toSeconds();
        return Math.max(0, seconds);
    }

    private void markGatewayRestarting(String gatewayId) {
        gatewayRestartingUntil.put(gatewayId, Instant.now().plus(GATEWAY_RESTART_EXPECTED_DURATION));
    }

    private void clearGatewayRestarting(String gatewayId) {
        gatewayRestartingUntil.remove(gatewayId);
    }

    public void syncMonitoringDataSnapshot(String gatewayId) {
        findById(gatewayId).ifPresentOrElse(gateway -> {
            String ipAddress = gateway.getIpAddress();
            if (ipAddress == null || ipAddress.isBlank()) {
                logger.warn("Skipping gateway monitoring snapshot for {}: missing IP address", gatewayId);
                return;
            }

            String threadId = "scheduler-" + gatewayId + "-" + System.currentTimeMillis();
            getMonitoringData(gatewayId, ipAddress, threadId)
                    .take(1)
                    .timeout(Duration.ofSeconds(20))
                    .doFinally(signal -> stopMonitoring(gatewayId, threadId))
                    .subscribe(
                            data -> logger.info("Stored gateway monitoring snapshot for {}", gatewayId),
                            error -> logger.warn("Unable to store gateway monitoring snapshot for {}: {}", gatewayId, error.getMessage())
                    );
        }, () -> logger.warn("Skipping gateway monitoring snapshot: gateway {} not found", gatewayId));
    }

    public Map<GatewayValueType, GatewayData> findLatestDataByGateway(String gatewayId) {
        return gatewayDataService.findLatestDataByGateway(gatewayId);
    }

    public LinkedHashMap<LocalDateTime, String> findGatewayDataByPeriodAndType(
            String gatewayId,
            Date startDate,
            Date endDate,
            GatewayValueType valueType,
            Optional<Integer> limit
    ) {
        return gatewayDataService.findGatewayDataByPeriodAndType(gatewayId, startDate, endDate, valueType, limit);
    }

    public Map<GatewayValueType, LinkedHashMap<LocalDateTime, String>> findGatewayDataByPeriod(
            String gatewayId,
            Date startDate,
            Date endDate
    ) {
        return gatewayDataService.findGatewayDataByPeriod(gatewayId, startDate, endDate);
    }

}
