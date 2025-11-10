package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.LorawanSensorData;
import com.amaris.sensorprocessor.entity.Sensor;
import com.amaris.sensorprocessor.repository.SensorDao;

import io.netty.channel.ChannelOption;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Flux;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class SensorService {

    private final SensorDao sensorDao;                 // DAO JdbcTemplate
    private final SensorLorawanService lorawanService; // Intégration TTN
    private final WebClient webClient;                 // Bean configuré (baseUrl = http://localhost:8081)
    private final WebClient webClientSse;              // SSE-specific WebClient

    @Value("${api.base.url}")
    private String baseUrl; // ex: http://localhost:8081

    /* ===================== MONITORING (SSE) ===================== */

    /**
     * Ouvre le flux SSE du microservice 8081 :
     * GET /api/monitoring/sensor/{appId}/{deviceId}?threadId=...
     * Retourne un Flux<String> (JSON brut) pour le pousser tel quel au navigateur via SseEmitter.
     */
    public Flux<String> getMonitoringData(String appId, String deviceId, String threadId) {
        return webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/monitoring/sensor/{appId}/{deviceId}")
                        .queryParam("threadId", threadId)
                        .build(appId, deviceId))
                .accept(MediaType.TEXT_EVENT_STREAM)
                .retrieve()
                .bodyToFlux(String.class)
                .doOnError(err -> log.error(
                        "[Sensor] SSE error appId={}, deviceId={}: {}",
                        appId, deviceId, err.getMessage(), err));
    }

    public Flux<String> getGatewayDevices(String appId) {
        // Use the pre-configured SSE WebClient bean
        return webClientSse.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/monitoring/sensor/{appId}")
                        .build(appId))
                .accept(MediaType.TEXT_EVENT_STREAM)
                .retrieve()
                .bodyToFlux(String.class)
                .doOnError(err -> {
                    log.error("[Sensor] SSE error appId={}: {}", appId, err.getMessage(), err);
                });
    }

    /**
     * Demande l'arrêt du monitoring côté microservice 8081.
     * GET /api/monitoring/sensor/stop/{deviceId}?threadId=...
     */
    public void stopMonitoring(String deviceId, String threadId) {
        webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/monitoring/sensor/stop/{deviceId}")
                        .queryParam("threadId", threadId)
                        .build(deviceId))
                .retrieve()
                .toBodilessEntity()
                .doOnSuccess(ok -> log.info(
                        "[Sensor] Monitoring stopped for deviceId={}, threadId={}",
                        deviceId, threadId
                ))
                .doOnError(err -> log.error(
                        "[Sensor] Stop monitoring error for deviceId={}, threadId={}: {}",
                        deviceId, threadId, err.getMessage(), err
                ))
                .subscribe();
    }

    /* ===================== READ ===================== */

    public List<Sensor> findAll() {
        return sensorDao.findAllSensors();
    }

    public Optional<Sensor> findByIdSensor(String idSensor) {
        return sensorDao.findByIdOfSensor(idSensor);
    }

    public Sensor getOrThrow(String idSensor) {
        return findByIdSensor(idSensor)
                .orElseThrow(() -> new IllegalArgumentException("Sensor not found: " + idSensor));
    }

    /* ===================== CREATE ===================== */

    @Transactional
    public Sensor create(Sensor toCreate) {
        if (toCreate.getIdSensor() == null || toCreate.getIdSensor().isBlank())
            throw new IllegalArgumentException("idSensor is required");

        if (sensorDao.findByIdOfSensor(toCreate.getIdSensor()).isPresent())
            throw new IllegalStateException("idSensor already exists: " + toCreate.getIdSensor());

        if (toCreate.getCommissioningDate() == null || toCreate.getCommissioningDate().isBlank())
            toCreate.setCommissioningDate(Instant.now().toString());

        if (toCreate.getStatus() == null) toCreate.setStatus(Boolean.TRUE);

        // 1) Insert BDD (transactionnel)
        int rows = sensorDao.insertSensor(toCreate);
        if (rows != 1) throw new IllegalStateException("DB insert failed for sensor " + toCreate.getIdSensor());
        log.info("[Sensor] DB created idSensor={}", toCreate.getIdSensor());

        // 2) Création TTN
        try {
            if (toCreate.getIdGateway() == null || toCreate.getIdGateway().isBlank()) {
                log.warn("[Sensor] No idGateway provided for {} → skipping TTN create", toCreate.getIdSensor());
            } else {
                LorawanSensorData lorawan = lorawanService.toLorawanCreate(toCreate);
                lorawanService.createDevice(toCreate.getIdGateway(), lorawan);
                log.info("[Sensor] TTN created device {} (app={}-app)", toCreate.getIdSensor(), toCreate.getIdGateway());
            }
        } catch (WebClientResponseException e) {
            if (e.getStatusCode().value() == 409) {
                log.warn("[Sensor] TTN device {} already exists (409). Continue.", toCreate.getIdSensor());
            } else {
                log.error("[Sensor] TTN create failed for {}: {}", toCreate.getIdSensor(), e.getMessage(), e);
            }
        } catch (Exception e) {
            log.error("[Sensor] TTN create unexpected error for {}: {}", toCreate.getIdSensor(), e.getMessage(), e);
        }

        return sensorDao.findByIdOfSensor(toCreate.getIdSensor()).orElse(toCreate);
    }

    /* ===================== UPDATE ===================== */

    @Transactional
    public Sensor update(String idSensor, Sensor patch) {
        Sensor existing = getOrThrow(idSensor);

        // Pas de renommage d'ID
        if (patch.getIdSensor() != null && !patch.getIdSensor().isBlank()
                && !patch.getIdSensor().equals(existing.getIdSensor())) {
            throw new IllegalArgumentException("Renaming idSensor is not supported by current DAO");
        }

        // Détection des changements critiques (DevEUI, JoinEUI, AppKey)
        boolean ttnUpdateNeeded = false;
        if (patch.getDevEui() != null && !patch.getDevEui().equals(existing.getDevEui())) {
            existing.setDevEui(patch.getDevEui());
            ttnUpdateNeeded = true;
        }
        if (patch.getJoinEui() != null && !patch.getJoinEui().equals(existing.getJoinEui())) {
            existing.setJoinEui(patch.getJoinEui());
            ttnUpdateNeeded = true;
        }
        if (patch.getAppKey() != null && !patch.getAppKey().equals(existing.getAppKey())) {
            existing.setAppKey(patch.getAppKey());
            ttnUpdateNeeded = true;
        }

        // Champs DB-only
        if (patch.getDeviceType() != null)        existing.setDeviceType(patch.getDeviceType());
        if (patch.getCommissioningDate() != null) existing.setCommissioningDate(patch.getCommissioningDate());
        if (patch.getFloor() != null)             existing.setFloor(patch.getFloor());
        if (patch.getLocation() != null)          existing.setLocation(patch.getLocation());
        if (patch.getBuildingName() != null)      existing.setBuildingName(patch.getBuildingName());

        // 1) Update DB
        int rows = sensorDao.updateSensor(existing);
        if (rows != 1) throw new IllegalStateException("DB update failed for sensor " + idSensor);
        log.info("[Sensor] DB updated idSensor={}", idSensor);

        // 2) Update TTN si nécessaire
        if (ttnUpdateNeeded) {
            try {
                if (existing.getIdGateway() == null || existing.getIdGateway().isBlank()) {
                    log.warn("[Sensor] No idGateway for {} → skipping TTN update", idSensor);
                } else {
                    LorawanSensorData lorawan = lorawanService.toLorawanCreate(existing);
                    lorawanService.updateDevice(existing.getIdGateway(), idSensor, lorawan);
                    log.info("[Sensor] TTN updated device {} (app={}-app)", idSensor, existing.getIdGateway());
                }
            } catch (WebClientResponseException e) {
                log.error("[Sensor] TTN update failed for {}: {}", idSensor, e.getMessage(), e);
                // On ne rollback pas la transaction DB, juste un warning
            } catch (Exception e) {
                log.error("[Sensor] TTN update unexpected error for {}: {}", idSensor, e.getMessage(), e);
            }
        }

        return existing;
    }

    /* ===================== DELETE ===================== */

    @Transactional
    public void delete(String idSensor) {
        Sensor existing = getOrThrow(idSensor);

        try {
            lorawanService.deleteDevice(existing.getIdGateway(), idSensor);
            log.info("[Sensor] TTN deleted device {} (app={}-app)", idSensor, existing.getIdGateway());
        } catch (WebClientResponseException e) {
            if (e.getStatusCode().value() == 404) {
                // Déjà supprimé côté TTN : OK, on continue
                log.warn("[Sensor] TTN device {} not found in app {}-app (already deleted?)",
                        idSensor, existing.getIdGateway());
            } else {
                log.error("[Sensor] TTN delete failed for {} (app={}-app): {}",
                        idSensor, existing.getIdGateway(), e.getMessage());
            }
        } catch (Exception e) {
            log.error("[Sensor] TTN delete unexpected error for {}: {}", idSensor, e.getMessage(), e);
        }

        int rows = sensorDao.deleteByIdOfSensor(idSensor);
        if (rows == 0) throw new IllegalArgumentException("Sensor not found: " + idSensor);

        log.info("[Sensor] DB deleted idSensor={}", idSensor);
    }

    /* ===================== SET STATUS ===================== */

    @Transactional
    public Sensor setStatus(String idSensor, boolean active) {
        Sensor existing = getOrThrow(idSensor);
        existing.setStatus(active);

        int rows = sensorDao.updateSensor(existing);
        if (rows != 1) throw new IllegalStateException("DB update status failed for " + idSensor);

        return existing;
    }
}
