package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.config.AlertThresholdConfig;
import com.amaris.sensorprocessor.entity.DeviceType;
import com.amaris.sensorprocessor.entity.Gateway;
import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.amaris.sensorprocessor.entity.Sensor;
import com.amaris.sensorprocessor.entity.SensorData;
import com.amaris.sensorprocessor.model.dashboard.Alert;
import com.amaris.sensorprocessor.repository.SensorDao;
import com.amaris.sensorprocessor.repository.SensorDataDao;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.relational.core.sql.In;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
public class AlertService {

    private static final String DEVICE_TYPE_CO2 = "CO2";
    private static final String DEVICE_TYPE_TEMP = "TEMPEX";
    private static final String DEVICE_TYPE_HUMIDITY = "HUMIDITY";
    private static final String DEVICE_TYPE_NOISE = "NOISE";

    private static final long CACHE_TTL_MS = 30_000;
    private final Map<String, CachedAlerts> alertCache = new ConcurrentHashMap<>();

    private static class CachedAlerts {
        final List<Alert> alerts;
        final long timestamp;

        CachedAlerts(List<Alert> alerts) {
            this.alerts = alerts;
            this.timestamp = System.currentTimeMillis();
        }

        boolean isExpired() {
            return System.currentTimeMillis() - timestamp > CACHE_TTL_MS;
        }
    }

    private final SensorDataDao sensorDataDao;
    private final SensorDao sensorDao;
    private final AlertThresholdConfig thresholdConfig;
    private final WebClient webClientSse;
    private final DeviceTypeService deviceTypeService;
    private final GatewayService gatewayService;

    @Autowired
    private LiveSensorCache liveSensorCache;
    @Autowired
    private ObjectMapper objectMapper;

    private Disposable currentSubscription;

    @Autowired
    public AlertService(SensorDataDao sensorDataDao, SensorDao sensorDao,
                        AlertThresholdConfig thresholdConfig, WebClient webClientSse,
                        DeviceTypeService deviceTypeService, GatewayService gatewayService) {
        this.sensorDataDao = sensorDataDao;
        this.sensorDao = sensorDao;
        this.thresholdConfig = thresholdConfig;
        this.webClientSse = webClientSse;
        this.deviceTypeService = deviceTypeService;
        this.gatewayService = gatewayService;
    }

    public List<Alert> getCurrentAlerts(Integer buildingId) {
        String cacheKey = buildingId == null ? "_ALL_" : String.valueOf(buildingId);

        CachedAlerts cached = alertCache.get(cacheKey);
        if (cached != null && !cached.isExpired()) {
            log.debug("⚡ Alert cache HIT for building: {}", cacheKey);
            return new ArrayList<>(cached.alerts);
        }

        log.debug("🔄 Alert cache MISS - computing alerts for: {}", cacheKey);

        List<Alert> alerts = new ArrayList<>();
        alerts.addAll(checkCO2Alerts(buildingId));
        alerts.addAll(checkTemperatureAlerts(buildingId));
        alerts.addAll(checkSensorOfflineAlerts(buildingId));
        alerts.addAll(checkHumidityAlerts(buildingId));
        alerts.addAll(checkNoiseAlerts(buildingId));

        alertCache.put(cacheKey, new CachedAlerts(alerts));
        log.debug("✅ Cached {} alerts for building: {}", alerts.size(), cacheKey);

        return alerts;
    }

    public void invalidateCache(String building) {
        String cacheKey = building == null || building.isBlank() ? "_ALL_" : building;
        alertCache.remove(cacheKey);
        log.debug("🗑️ Alert cache invalidated for: {}", cacheKey);
    }

    private List<Alert> checkCO2Alerts(Integer building) {
        List<Alert> alerts = new ArrayList<>();
        List<Sensor> co2Sensors = sensorDao.findAllByDeviceTypeAndBuilding(DEVICE_TYPE_CO2, building);

        for (Sensor sensor : co2Sensors) {
            Optional<SensorData> latestCO2 = liveSensorCache.getLatest(sensor.getIdSensor(), PayloadValueType.CO2);
            if (latestCO2.isEmpty()) {
                latestCO2 = sensorDataDao.findLatestBySensorAndType(sensor.getIdSensor(), PayloadValueType.CO2);
            }

            if (latestCO2.isPresent()) {
                SensorData data = latestCO2.get();
                if (data.getReceivedAt().isAfter(LocalDateTime.now().minusMinutes(thresholdConfig.getDataMaxAgeMinutes()))) {
                    try {
                        double co2Value = Double.parseDouble(data.getValueAsString());
                        if (co2Value > thresholdConfig.getCo2().getCritical()) {
                            alerts.add(new Alert("critical", "⚠️", "Critical CO2 Level",
                                    String.format("Sensor %s detected %.0f ppm (threshold: %.0f ppm)",
                                            sensor.getIdSensor(), co2Value, thresholdConfig.getCo2().getCritical()),
                                    formatTimeAgo(data.getReceivedAt())));
                        } else if (co2Value > thresholdConfig.getCo2().getWarning()) {
                            alerts.add(new Alert("warning", "🔔", "High CO2 Level",
                                    String.format("Sensor %s detected %.0f ppm (threshold: %.0f ppm)",
                                            sensor.getIdSensor(), co2Value, thresholdConfig.getCo2().getWarning()),
                                    formatTimeAgo(data.getReceivedAt())));
                        }
                    } catch (NumberFormatException e) {
                        log.warn("Invalid CO2 value for sensor {}: {}", sensor.getIdSensor(), data.getValueAsString());
                    }
                }
            }
        }
        return alerts;
    }

    private List<Alert> checkTemperatureAlerts(Integer building) {
        List<Alert> alerts = new ArrayList<>();
        List<Sensor> co2Sensors = sensorDao.findAllByDeviceTypeAndBuilding(DEVICE_TYPE_CO2, building);
        List<Sensor> tempSensors = sensorDao.findAllByDeviceTypeAndBuilding(DEVICE_TYPE_TEMP, building);

        List<Sensor> allTempSensors = new ArrayList<>();
        allTempSensors.addAll(co2Sensors);
        allTempSensors.addAll(tempSensors);

        for (Sensor sensor : allTempSensors) {
            Optional<SensorData> latestTemp = liveSensorCache.getLatest(sensor.getIdSensor(), PayloadValueType.TEMPERATURE);
            if (latestTemp.isEmpty()) {
                latestTemp = sensorDataDao.findLatestBySensorAndType(sensor.getIdSensor(), PayloadValueType.TEMPERATURE);
            }

            if (latestTemp.isPresent()) {
                SensorData data = latestTemp.get();
                if (data.getReceivedAt().isAfter(LocalDateTime.now().minusMinutes(thresholdConfig.getDataMaxAgeMinutes()))) {
                    try {
                        double tempValue = Double.parseDouble(data.getValueAsString());
                        if (tempValue > thresholdConfig.getTemperature().getCriticalHigh()
                                || tempValue < thresholdConfig.getTemperature().getCriticalLow()) {
                            alerts.add(new Alert("critical", "🌡️", "Critical Temperature",
                                    String.format("Room %s temperature at %.1f°C (critical range: %.1f-%.1f°C)",
                                            getRoomName(sensor.getIdSensor()), tempValue,
                                            thresholdConfig.getTemperature().getCriticalLow(),
                                            thresholdConfig.getTemperature().getCriticalHigh()),
                                    formatTimeAgo(data.getReceivedAt())));
                        } else if (tempValue > thresholdConfig.getTemperature().getWarningHigh()
                                || tempValue < thresholdConfig.getTemperature().getWarningLow()) {
                            alerts.add(new Alert("warning", "🌡️", "Uncomfortable Temperature",
                                    String.format("Room %s temperature at %.1f°C (comfort range: %.1f-%.1f°C)",
                                            getRoomName(sensor.getIdSensor()), tempValue,
                                            thresholdConfig.getTemperature().getWarningLow(),
                                            thresholdConfig.getTemperature().getWarningHigh()),
                                    formatTimeAgo(data.getReceivedAt())));
                        }
                    } catch (NumberFormatException e) {
                        log.warn("Invalid temperature value for sensor {}: {}", sensor.getIdSensor(), data.getValueAsString());
                    }
                }
            }
        }
        return alerts;
    }

    private List<Alert> checkSensorOfflineAlerts(Integer building) {
        List<Alert> alerts = new ArrayList<>();
        List<Sensor> allSensors = sensorDao.findAllByBuildingId(building);

        log.debug("Checking {} sensors for offline status", allSensors.size());

        // ✅ Charger tous les device types en une seule requête (optimisation)
        Map<Integer, String> deviceTypeMap = deviceTypeService.findAll().stream()
                .collect(Collectors.toMap(DeviceType::getIdDeviceType, DeviceType::getLabel));

        int deskCount = 0, otherCount = 0;

        for (Sensor sensor : allSensors) {
            String sensorId = sensor.getIdSensor();

            // ✅ Récupérer le label via la map (pas de requête supplémentaire)
            String deviceType = deviceTypeMap.getOrDefault(sensor.getIdDeviceType(), "UNKNOWN");

            int thresholdMinutes = getOfflineThresholdForDeviceType(deviceType);
            LocalDateTime cutoffTime = LocalDateTime.now().minusMinutes(thresholdMinutes);

            Optional<SensorData> latestData = sensorDataDao.findLatestBySensor(sensorId);

            if (latestData.isPresent()) {
                SensorData data = latestData.get();

                if (data.getReceivedAt().isBefore(cutoffTime) || data.getReceivedAt().isEqual(cutoffTime)) {
                    if ("DESK".equalsIgnoreCase(deviceType)) {
                        deskCount++;
                    } else {
                        otherCount++;
                    }
                    alerts.add(new Alert("info", "ℹ️", "Sensor Offline",
                            String.format("%s (%s) not responding", sensorId, deviceType),
                            formatTimeAgo(data.getReceivedAt())));
                }
            } else {
                log.debug("Sensor {} ({}) has no data in database", sensorId, deviceType);
            }
        }

        log.debug("Found {} offline sensors (DESK: {}, Other: {})", alerts.size(), deskCount, otherCount);
        return alerts;
    }

    private int getOfflineThresholdForDeviceType(String deviceType) {
        if (deviceType == null) {
            return thresholdConfig.getDataMaxAgeMinutes();
        }
        return switch (deviceType.toUpperCase()) {
            case "DESK"      -> thresholdConfig.getDeskOfflineThresholdHours() * 60;
            case "OCCUP"     -> thresholdConfig.getOccupOfflineThresholdHours() * 60;
            case "PIR_LIGHT" -> thresholdConfig.getPirLightOfflineThresholdHours() * 60;
            case "COUNT"     -> thresholdConfig.getCountOfflineThresholdHours() * 60;
            default          -> thresholdConfig.getDataMaxAgeMinutes();
        };
    }

    private List<Alert> checkHumidityAlerts(Integer building) {
        List<Alert> alerts = new ArrayList<>();
        List<Sensor> co2Sensors = sensorDao.findAllByDeviceTypeAndBuilding(DEVICE_TYPE_CO2, building);
        List<Sensor> humiditySensors = sensorDao.findAllByDeviceTypeAndBuilding(DEVICE_TYPE_HUMIDITY, building);

        List<Sensor> allHumiditySensors = new ArrayList<>();
        allHumiditySensors.addAll(co2Sensors);
        allHumiditySensors.addAll(humiditySensors);

        for (Sensor sensor : allHumiditySensors) {
            Optional<SensorData> latestHumidity = liveSensorCache.getLatest(sensor.getIdSensor(), PayloadValueType.HUMIDITY);
            if (latestHumidity.isEmpty()) {
                latestHumidity = sensorDataDao.findLatestBySensorAndType(sensor.getIdSensor(), PayloadValueType.HUMIDITY);
            }

            if (latestHumidity.isPresent()) {
                SensorData data = latestHumidity.get();
                if (data.getReceivedAt().isAfter(LocalDateTime.now().minusMinutes(thresholdConfig.getDataMaxAgeMinutes()))) {
                    try {
                        double humidityValue = Double.parseDouble(data.getValueAsString());
                        if (humidityValue > thresholdConfig.getHumidity().getWarningHigh()
                                || humidityValue < thresholdConfig.getHumidity().getWarningLow()) {
                            alerts.add(new Alert("warning", "💧", "Abnormal Humidity",
                                    String.format("Room %s humidity at %.0f%% (ideal range: %.0f-%.0f%%)",
                                            getRoomName(sensor.getIdSensor()), humidityValue,
                                            thresholdConfig.getHumidity().getWarningLow(),
                                            thresholdConfig.getHumidity().getWarningHigh()),
                                    formatTimeAgo(data.getReceivedAt())));
                        }
                    } catch (NumberFormatException e) {
                        log.warn("Invalid humidity value for sensor {}: {}", sensor.getIdSensor(), data.getValueAsString());
                    }
                }
            }
        }
        return alerts;
    }

    private List<Alert> checkNoiseAlerts(Integer building) {
        List<Alert> alerts = new ArrayList<>();
        List<Sensor> noiseSensors = sensorDao.findAllByDeviceTypeAndBuilding(DEVICE_TYPE_NOISE, building);

        for (Sensor sensor : noiseSensors) {
            Optional<SensorData> latestNoise = liveSensorCache.getLatest(sensor.getIdSensor(), PayloadValueType.LAEQ);
            if (latestNoise.isEmpty()) {
                latestNoise = sensorDataDao.findLatestBySensorAndType(sensor.getIdSensor(), PayloadValueType.LAEQ);
            }

            if (latestNoise.isPresent()) {
                SensorData data = latestNoise.get();
                if (data.getReceivedAt().isAfter(LocalDateTime.now().minusMinutes(thresholdConfig.getDataMaxAgeMinutes()))) {
                    try {
                        double noiseValue = Double.parseDouble(data.getValueAsString());
                        if (noiseValue > thresholdConfig.getNoise().getWarning()) {
                            alerts.add(new Alert("warning", "🔉", "High Noise Level",
                                    String.format("Room %s noise level at %.0f dB (threshold: %.0f dB)",
                                            getRoomName(sensor.getIdSensor()), noiseValue,
                                            thresholdConfig.getNoise().getWarning()),
                                    formatTimeAgo(data.getReceivedAt())));
                        }
                    } catch (NumberFormatException e) {
                        log.warn("Invalid noise value for sensor {}: {}", sensor.getIdSensor(), data.getValueAsString());
                    }
                }
            }
        }
        return alerts;
    }

    private String formatTimeAgo(LocalDateTime timestamp) {
        LocalDateTime now = LocalDateTime.now();
        long minutes = java.time.Duration.between(timestamp, now).toMinutes();

        if (minutes < 0) {
            log.warn("Timestamp is in the future: {} vs now: {}", timestamp, now);
            return "just now";
        }
        if (minutes < 1) return "just now";
        else if (minutes < 60) return minutes + " minutes ago";
        else if (minutes < 1440) {
            long hours = minutes / 60;
            return hours + (hours == 1 ? " hour ago" : " hours ago");
        } else {
            return timestamp.format(DateTimeFormatter.ofPattern("dd/MM HH:mm"));
        }
    }

    private String getRoomName(String sensorId) {
        if (sensorId.contains("F1")) return "Floor 1";
        if (sensorId.contains("F2")) return "Floor 2";
        if (sensorId.contains("B1")) return "Basement";
        if (sensorId.contains("B2")) return "Basement 2";
        return sensorId;
    }

    public Flux<String> getMonitoringMany(String appId, List<String> deviceIds) {
        return webClientSse.post()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/monitoring/app/{appId}/stream")
                        .build(appId))
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(deviceIds == null ? List.of() : deviceIds)
                .retrieve()
                .bodyToFlux(String.class)
                .doOnSubscribe(sub -> log.info("[Sensor] SSE SUBSCRIBED appId={} devices={}", appId, deviceIds))
                .doOnNext(raw -> log.info("[Sensor] SSE RAW EVENT appId={} => {}", appId, raw))
                .doOnCancel(() -> log.warn("[Sensor] SSE CANCELLED appId={}", appId))
                .doOnComplete(() -> log.warn("[Sensor] SSE COMPLETED appId={}", appId))
                .doOnError(err -> log.error("[Sensor] SSE multi error appId={}: {}", appId, err.getMessage(), err))
                .doOnNext(this::parseAndUpdateCache);
    }

    private void parseAndUpdateCache(String payload) {
        try {
            JsonNode root = objectMapper.readTree(payload);
            JsonNode result = root.path("result");
            if (result.isMissingNode()) {
                log.warn("No result node in payload");
                return;
            }

            String devEui = result.path("end_device_ids").path("dev_eui").asText();
            if (devEui == null || devEui.isBlank()) return;

            String idSensor = sensorDao.findByDevEui(devEui)
                    .map(Sensor::getIdSensor)
                    .orElse(null);

            if (idSensor == null) {
                log.warn("No sensor found for devEui={}", devEui);
                return;
            }

            String receivedAtStr = result.path("received_at").asText();
            LocalDateTime receivedAt = OffsetDateTime.parse(receivedAtStr).toLocalDateTime();

            JsonNode decoded = result.path("uplink_message").path("decoded_payload");
            if (decoded.isMissingNode()) return;

            Map<String, PayloadValueType> typeMapping = Map.of(
                    "co2", PayloadValueType.CO2,
                    "temperature", PayloadValueType.TEMPERATURE,
                    "humidity", PayloadValueType.HUMIDITY,
                    "laeq", PayloadValueType.LAEQ
            );

            for (Map.Entry<String, PayloadValueType> entry : typeMapping.entrySet()) {
                String key = entry.getKey();
                PayloadValueType valueType = entry.getValue();
                if (decoded.has(key)) {
                    String valueStr = decoded.path(key).asText();
                    try {
                        SensorData data = new SensorData(idSensor, receivedAt, valueStr, valueType.name());
                        liveSensorCache.updateSensorValue(idSensor, valueType, data);
                        log.info("CACHE UPDATE {} → {} = {}", valueType, idSensor, valueStr);
                    } catch (Exception e) {
                        log.warn("Failed to update cache for sensor {} type {} with value {}", idSensor, valueType, valueStr, e);
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error parsing SSE payload", e);
        }
    }

    public void startMonitoringForBuilding(String building, String sensorType, Integer dbBuildingId) {
        if (currentSubscription != null && !currentSubscription.isDisposed()) {
            currentSubscription.dispose();
        }

        List<Gateway> gateways = gatewayService.findByBuildingId(dbBuildingId);
        String appId = gateways.isEmpty()
                ? "rpi-mantu-appli"
                : resolveAppIdFromGateway(gateways.get(0), "rpi-mantu-appli");

        List<Sensor> sensors = sensorDao.findAllByDeviceTypeAndBuilding(sensorType, dbBuildingId);
        List<String> deviceIds = sensors.stream().map(Sensor::getIdSensor).toList();

        currentSubscription = getMonitoringMany(appId, deviceIds).subscribe();
    }

    private String resolveAppIdFromGateway(Gateway gw, String defaultValue) {
        if (gw.getBuildingId() == null) return defaultValue;
        return switch (gw.getGatewayId().toLowerCase()) {
            case "leva-rpi-mantu" -> "lorawan-network-mantu";
            default               -> gw.getGatewayId() + "-appli";
        };
    }

    public List<Alert> getCurrentAlertsWithWait(Integer buildingId, int maxWaitMs) {
        int intervalMs = 100;
        int waited = 0;

        while (liveSensorCache.isEmpty(buildingId) && waited < maxWaitMs) {
            try {
                Thread.sleep(intervalMs);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
            waited += intervalMs;
        }
        return getCurrentAlerts(buildingId);
    }

}
