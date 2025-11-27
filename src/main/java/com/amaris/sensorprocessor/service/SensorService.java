package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.LorawanSensorData;
import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.amaris.sensorprocessor.entity.Sensor;
import com.amaris.sensorprocessor.entity.SensorData;
import com.amaris.sensorprocessor.repository.SensorDao;
import com.amaris.sensorprocessor.repository.SensorDataDao;

import io.netty.channel.ChannelOption;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Flux;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SensorService {

    private final SensorDao sensorDao;                 // DAO JdbcTemplate
    private final SensorDataDao sensorDataDao;            // Sensor Data DAO JdbcTemplate
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

    public Flux<String> getGatewayDevices(String appId, Instant after) {
        // Use the pre-configured SSE WebClient bean
        return webClientSse.get()
                .uri(uriBuilder -> {
                    uriBuilder.path("/api/monitoring/sensor/{appId}");
                    if (after != null) {
                        uriBuilder.queryParam("after", after.toString());
                    }
                    return uriBuilder.build(appId);
                })
                .accept(MediaType.TEXT_EVENT_STREAM)
                .retrieve()
                .bodyToFlux(String.class)
                .timeout(java.time.Duration.ofSeconds(120))
                .onErrorResume(java.util.concurrent.TimeoutException.class, e -> {
                    log.warn("[Sensor] SSE timeout for appId={}: {}", appId, e.getMessage());
                    return Flux.empty(); // Return an empty Flux to quietly ignore the timeout
                })
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

    /**
     * Retrieves the latest sensor data for a given sensor ID.
     * 
     * <pre>
     * {@code
     * // Example usage
     * var data = sensorService.getSensorData("co2-03-03");
     * Double temp = data.get(PayloadValueType.TEMPERATURE).getValueAsDouble();
     * }
     * </pre>
     * 
     * @param idSensor ID of thte TTN Sensor. Available in the TTN gateway admin console.
     * 
     * @return A hash map 
     */
    public HashMap<PayloadValueType, SensorData> getSensorData(String idSensor) {
        return sensorDataDao.findLatestDataBySensor(idSensor);
    }

    /**
     * Récupère toutes les données d'une métrique associée à un
     * capteur (Sensor) pour une période donnée.
     * Les dates de début et de fin sont *inclus* dans la recherche.
     * 
     * <pre>
     * // Example
     * 
     * </pre>
     * 
     * @param idSensor ID du Sensor ou Device ID
     * @param startDate Date de début (inclusive)
     * @param endDate Date de fin (inclusive)
     * @param valueType
     * @return LinkedHashMap de SensorData triés par date du plus anciens au plus récent.
     */
    public LinkedHashMap<LocalDateTime, String> findSensorDataByPeriodAndType(String idSensor, Date startDate, Date endDate, PayloadValueType valueType) {
        var datas = sensorDataDao.findSensorDataByPeriodAndType(idSensor, startDate, endDate, valueType);
        LinkedHashMap<LocalDateTime, String> timeToStringValueMap = new LinkedHashMap<>();
        for (SensorData data : datas) {
            var receivedDate = data.getReceivedAt();
            timeToStringValueMap.put(receivedDate, data.getValueAsString());
        }
        return timeToStringValueMap;
    }

    public Map<PayloadValueType, LinkedHashMap<LocalDateTime, String>> findSensorDataByPeriod(String idSensor, Date startDate, Date endDate) {
        List<SensorData> allSensorDatas = sensorDataDao.findSensorDataByPeriod(idSensor, startDate, endDate);
        /*
          // Prepare a javascript object that looks like this:
          {
            "TEMPERATURE": [
              "2025-11-17T13:21:06.841481": 123
              "2025-11-18T13:21:06.841481": 456
            ],
            "RSSI": [
              "2025-11-17T13:21:06.841481": 123
              "2025-11-18T13:21:06.841481": 456
            ],
          }
        */
        
        // Group data by value_type
        Map<PayloadValueType, LinkedHashMap<LocalDateTime, String>> groupedData = new LinkedHashMap<>();
        
        // Each group contains a LinkedHashMap for the value_type
        for (SensorData data : allSensorDatas) {
            groupedData.computeIfAbsent(data.getValueType(), k -> new LinkedHashMap<>())
                       .put(data.getReceivedAt(), data.getValueAsString());
        }
        
        return groupedData;
    }

    // TODO: refactor
    public Map<Date, Double> getConsumptionByChannels(String idSensor, Date startDate, Date endDate, List<String> channels) {
        // Convert channel strings to a Set of PayloadValueType enums for efficient lookup.
        Set<PayloadValueType> consumptionChannels = channels.stream().map(PayloadValueType::valueOf).collect(Collectors.toSet());

        // Fetch all sensor data for the period in a single query.
        List<SensorData> allSensorData = sensorDataDao.findSensorDataByPeriodAndTypes2(idSensor, startDate, endDate, consumptionChannels);

        // Create hourly time series and resample data efficiently.
        Instant startInstant = startDate.toInstant().truncatedTo(ChronoUnit.HOURS);
        Instant endInstant = endDate.toInstant();
        Map<Instant, Double> hourlyTotals = new LinkedHashMap<>();

        // Get initial values at the start of the period for each channel
        Map<PayloadValueType, Double> lastKnownValues = new HashMap<>();
        for (PayloadValueType channel : consumptionChannels) {
            Optional<SensorData> lastData = sensorDataDao.findLastValueBefore(idSensor, channel, startInstant);
            lastKnownValues.put(channel, lastData.map(SensorData::getValueAsDouble).orElse(0.0));
        }

        // Initialize hourly slots and iterate through them once
        Instant currentHour = startInstant;
        int dataIndex = 0;

        while (!currentHour.isAfter(endInstant)) {
            // Advance data pointer to catch up to the current hour
            while (dataIndex < allSensorData.size()) {
                SensorData dataPoint = allSensorData.get(dataIndex);
                Instant dataTimestamp = dataPoint.getReceivedAt().atZone(ZoneId.systemDefault()).toInstant();

                if (dataTimestamp.isAfter(currentHour)) {
                    break; // This data point is for a future hour
                }

                Double value = dataPoint.getValueAsDouble();
                if (value != null) {
                    lastKnownValues.put(dataPoint.getValueType(), value);
                }
                dataIndex++;
            }

            // Calculate the total for the current hour using the last known values
            double totalForHour = lastKnownValues.values().stream().mapToDouble(Double::doubleValue).sum();
            hourlyTotals.put(currentHour, totalForHour);

            currentHour = currentHour.plus(1, ChronoUnit.HOURS);
        }

        // Calculate differential consumption from the hourly totals
        Map<Date, Double> finalHourlyConsumption = new LinkedHashMap<>();
        List<Instant> hours = new ArrayList<>(hourlyTotals.keySet());
        hours.sort(Instant::compareTo);

        for (int i = 1; i < hours.size(); i++) {
            Instant previousHour = hours.get(i - 1);
            Instant currentHourKey = hours.get(i);

            double previousTotalValue = hourlyTotals.get(previousHour);
            double currentTotalValue = hourlyTotals.get(currentHourKey);

            double consumption;
            if (currentTotalValue < previousTotalValue) {
                consumption = currentTotalValue; // Assume counter reset
            } else {
                consumption = currentTotalValue - previousTotalValue;
            }
            finalHourlyConsumption.put(Date.from(currentHourKey), consumption);
        }

        return finalHourlyConsumption;
    }

    /**
     * Calculates the total consumption over a user-defined period (in minutes) for a given sensor.
     * It sums up the latest values from all consumption channels and subtracts the
     * sum of the values from the start of the period for the specified channels.
     *
     * @param idSensor The ID of the sensor.
     * @param channels A list of channel numbers (as strings) to include in the calculation.
     * @param minutes The duration of the period in minutes.
     * @return The total consumption in the last N minutes as a Double. Returns null if no data is available.
     */
    public Double getCurrentConsumption(String idSensor, List<String> channels, int minutes) {
        Instant now = Instant.now();
        // If minutes is 0 or less, default to 1 minute to avoid errors
        Instant timeAgo = now.minus(Math.max(1, minutes), ChronoUnit.MINUTES);

        if (channels == null || channels.isEmpty()) {
            return 0.0;
        }

        // Convert channel numbers to PayloadValueType enums
        Set<PayloadValueType> consumptionChannels = channels.stream()
            .map(ch -> PayloadValueType.valueOf("CONSUMPTION_CHANNEL_" + ch))
            .collect(Collectors.toSet());

        if (consumptionChannels.isEmpty()) {
            return 0.0;
        }

        // Get the latest data points within the last N minutes for all consumption channels
        List<SensorData> recentData = sensorDataDao.findSensorDataByPeriodAndTypes2(idSensor, Date.from(timeAgo), Date.from(now), consumptionChannels);

        // Group data by channel and find the latest and earliest value in the timeframe for each
        Map<PayloadValueType, List<SensorData>> dataByChannel = recentData.stream().collect(Collectors.groupingBy(SensorData::getValueType));

        double totalConsumption = 0;

        for (PayloadValueType channel : consumptionChannels) {
            List<SensorData> channelData = dataByChannel.get(channel);
            if (channelData != null && channelData.size() > 1) {
                // Assuming data is sorted by time, get first and last
                double latestValue = channelData.get(channelData.size() - 1).getValueAsDouble();
                double oldestValue = channelData.get(0).getValueAsDouble();
                totalConsumption += (latestValue - oldestValue);
            }
        }

        return totalConsumption > 0 ? totalConsumption : null;
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
