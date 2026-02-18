package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.config.AlertThresholdConfig;
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

@Slf4j
@Service
public class AlertService {

    // Device type constants
    private static final String DEVICE_TYPE_CO2 = "CO2";
    private static final String DEVICE_TYPE_TEMP = "TEMPEX";
    private static final String DEVICE_TYPE_HUMIDITY = "HUMIDITY";
    private static final String DEVICE_TYPE_NOISE = "NOISE";
    
    // ============ ALERT CACHE (30-second TTL) ============
    private static final long CACHE_TTL_MS = 30_000; // 30 seconds
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
    private final WebClient webClientSse;              // SSE-specific WebClient
    @Autowired
    private LiveSensorCache liveSensorCache;
    @Autowired
    private ObjectMapper objectMapper;
    private Disposable currentSubscription;
    private final Map<String, Disposable> subscriptions = new ConcurrentHashMap<>();

    @Autowired
    public AlertService(SensorDataDao sensorDataDao, SensorDao sensorDao, AlertThresholdConfig thresholdConfig, WebClient webClientSse) {
        this.sensorDataDao = sensorDataDao;
        this.sensorDao = sensorDao;
        this.thresholdConfig = thresholdConfig;
        this.webClientSse = webClientSse;
    }

    /**
     * Generate alerts based on current sensor data
     * Uses caching to avoid repeated expensive DB queries (30-second TTL)
     * 
     * @return List of active alerts
     */
    public List<Alert> getCurrentAlerts(String building) {
        String cacheKey = building == null || building.isBlank() ? "_ALL_" : building;
        
        // Check cache first
        CachedAlerts cached = alertCache.get(cacheKey);
        if (cached != null && !cached.isExpired()) {
            log.debug("⚡ Alert cache HIT for building: {}", cacheKey);
            return new ArrayList<>(cached.alerts); // Return copy to prevent modification
        }
        
        log.debug("🔄 Alert cache MISS - computing alerts for: {}", cacheKey);
        
        List<Alert> alerts = new ArrayList<>();

        // Check for CO2 alerts (includes temperature from CO2 sensors)
        alerts.addAll(checkCO2Alerts(building));

        // Check for temperature alerts
        alerts.addAll(checkTemperatureAlerts(building));

        // Check for sensor offline alerts
        alerts.addAll(checkSensorOfflineAlerts(building));

        // Check for humidity alerts
        alerts.addAll(checkHumidityAlerts(building));

        // Check for noise alerts
        alerts.addAll(checkNoiseAlerts(building));

        // Cache the results
        alertCache.put(cacheKey, new CachedAlerts(alerts));
        log.debug("✅ Cached {} alerts for building: {}", alerts.size(), cacheKey);

        return alerts;
    }
    
    /**
     * Force refresh the alert cache for a specific building
     */
    public void invalidateCache(String building) {
        String cacheKey = building == null || building.isBlank() ? "_ALL_" : building;
        alertCache.remove(cacheKey);
        log.debug("🗑️ Alert cache invalidated for: {}", cacheKey);
    }

    private boolean hasSensorType(String building, String sensorType) {
        if (building == null || building.isBlank()) {
            return true; // pas de filtre → dashboard global
        }
        return sensorDao.existsByBuildingAndType(building, sensorType);
    }


    /**
     * Check for CO2 level alerts
     * Critical: > configured critical threshold ppm
     * Warning: > configured warning threshold ppm
     */
    private List<Alert> checkCO2Alerts(String building) {
        List<Alert> alerts = new ArrayList<>();

        // Get all CO2 sensors from the database
        List<Sensor> co2Sensors = sensorDao.findAllByDeviceTypeAndBuilding(DEVICE_TYPE_CO2, building);

        for (Sensor sensor : co2Sensors) {
            // First try LiveSensorCache, then fall back to database
            Optional<SensorData> latestCO2 = liveSensorCache.getLatest(sensor.getIdSensor(), PayloadValueType.CO2);
            
            // FALLBACK: If cache is empty, query database directly
            if (latestCO2.isEmpty()) {
                latestCO2 = sensorDataDao.findLatestBySensorAndType(sensor.getIdSensor(), PayloadValueType.CO2);
            }

            if (latestCO2.isPresent()) {
                SensorData data = latestCO2.get();
                // Only consider recent readings (within configured time threshold)
                if (data.getReceivedAt()
                        .isAfter(LocalDateTime.now().minusMinutes(thresholdConfig.getDataMaxAgeMinutes()))) {
                    try {
                        double co2Value = Double.parseDouble(data.getValueAsString());

                        if (co2Value > thresholdConfig.getCo2().getCritical()) {
                            alerts.add(new Alert(
                                    "critical",
                                    "⚠️",
                                    "Critical CO2 Level",
                                    String.format("Sensor %s detected %.0f ppm (threshold: %.0f ppm)",
                                            sensor.getIdSensor(), co2Value, thresholdConfig.getCo2().getCritical()),
                                    formatTimeAgo(data.getReceivedAt())));
                        } else if (co2Value > thresholdConfig.getCo2().getWarning()) {
                            alerts.add(new Alert(
                                    "warning",
                                    "🔔",
                                    "High CO2 Level",
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

    /**
     * Check for temperature alerts
     * Critical: > configured critical high or < configured critical low
     * Warning: > configured warning high or < configured warning low
     */
    private List<Alert> checkTemperatureAlerts(String building) {
        List<Alert> alerts = new ArrayList<>();

        // Get all CO2 sensors that also have temperature data (multi-sensor devices)
        List<Sensor> co2Sensors = sensorDao.findAllByDeviceTypeAndBuilding(DEVICE_TYPE_CO2, building);
        // Also get dedicated temperature sensors
        List<Sensor> tempSensors = sensorDao.findAllByDeviceTypeAndBuilding(DEVICE_TYPE_TEMP, building);
        
        // Combine both lists
        List<Sensor> allTempSensors = new ArrayList<>();
        allTempSensors.addAll(co2Sensors); // CO2 sensors often have temperature
        allTempSensors.addAll(tempSensors);

        for (Sensor sensor : allTempSensors) {
            Optional<SensorData> latestTemp =
                    liveSensorCache.getLatest(sensor.getIdSensor(), PayloadValueType.TEMPERATURE);
            
            // FALLBACK: If cache is empty, query database directly
            if (latestTemp.isEmpty()) {
                latestTemp = sensorDataDao.findLatestBySensorAndType(sensor.getIdSensor(), PayloadValueType.TEMPERATURE);
            }

            if (latestTemp.isPresent()) {
                SensorData data = latestTemp.get();

                if (data.getReceivedAt()
                        .isAfter(LocalDateTime.now().minusMinutes(thresholdConfig.getDataMaxAgeMinutes()))) {
                    try {
                        double tempValue = Double.parseDouble(data.getValueAsString());

                        if (tempValue > thresholdConfig.getTemperature().getCriticalHigh()
                                || tempValue < thresholdConfig.getTemperature().getCriticalLow()) {
                            alerts.add(new Alert(
                                    "critical",
                                    "🌡️",
                                    "Critical Temperature",
                                    String.format("Room %s temperature at %.1f°C (critical range: %.1f-%.1f°C)",
                                            getRoomName(sensor.getIdSensor()), tempValue,
                                            thresholdConfig.getTemperature().getCriticalLow(),
                                            thresholdConfig.getTemperature().getCriticalHigh()),
                                    formatTimeAgo(data.getReceivedAt())));
                        } else if (tempValue > thresholdConfig.getTemperature().getWarningHigh()
                                || tempValue < thresholdConfig.getTemperature().getWarningLow()) {
                            alerts.add(new Alert(
                                    "warning",
                                    "🌡️",
                                    "Uncomfortable Temperature",
                                    String.format("Room %s temperature at %.1f°C (comfort range: %.1f-%.1f°C)",
                                            getRoomName(sensor.getIdSensor()), tempValue,
                                            thresholdConfig.getTemperature().getWarningLow(),
                                            thresholdConfig.getTemperature().getWarningHigh()),
                                    formatTimeAgo(data.getReceivedAt())));
                        }
                    } catch (NumberFormatException e) {
                        log.warn("Invalid temperature value for sensor {}: {}", sensor.getIdSensor(),
                                data.getValueAsString());
                    }
                }
            }
        }

        return alerts;
    }

    /**
     * Check for sensor offline alerts
     * Alert if no data received within the configured time threshold
     * Uses different thresholds for event-based sensors (DESK, OCCUP) vs continuous sensors
     */
    private List<Alert> checkSensorOfflineAlerts(String building) {
        List<Alert> alerts = new ArrayList<>();

        // Get all sensors from the database
        List<Sensor> allSensors = sensorDao.findAllByBuilding(building);

        log.debug("Checking {} sensors for offline status", allSensors.size());

        int deskCount = 0, otherCount = 0;

        for (Sensor sensor : allSensors) {
            String sensorId = sensor.getIdSensor();
            String deviceType = sensor.getDeviceType();

            // Get device-specific offline threshold
            int thresholdMinutes = getOfflineThresholdForDeviceType(deviceType);
            LocalDateTime cutoffTime = LocalDateTime.now().minusMinutes(thresholdMinutes);

            // Get the most recent data from this sensor (any type)
            Optional<SensorData> latestData = sensorDataDao.findLatestBySensor(sensorId);

            if (latestData.isPresent()) {
                SensorData data = latestData.get();
                long minutesAgo = java.time.Duration.between(data.getReceivedAt(), LocalDateTime.now()).toMinutes();

                // Check if the most recent data is older than the threshold
                if (data.getReceivedAt().isBefore(cutoffTime) || data.getReceivedAt().isEqual(cutoffTime)) {
                    if ("DESK".equalsIgnoreCase(deviceType)) {
                        deskCount++;
                    } else {
                        otherCount++;
                    }

                    alerts.add(new Alert(
                            "info",
                            "ℹ️",
                            "Sensor Offline",
                            String.format("%s (%s) not responding", sensorId, deviceType),
                            formatTimeAgo(data.getReceivedAt())));
                }
            } else {
                // No data found at all for this sensor - only alert if threshold exceeded
                log.debug("Sensor {} ({}) has no data in database", sensorId, deviceType);
            }
        }

        log.debug("Found {} offline sensors (DESK: {}, Other: {})", alerts.size(), deskCount, otherCount);
        return alerts;
    }

    /**
     * Get offline threshold in minutes based on device type
     * Event-based sensors (DESK, OCCUP) have longer thresholds
     */
    private int getOfflineThresholdForDeviceType(String deviceType) {
        if (deviceType == null) {
            return thresholdConfig.getDataMaxAgeMinutes();
        }

        // Event-based sensors: only send data on state change
        switch (deviceType.toUpperCase()) {
            case "DESK":
                return thresholdConfig.getDeskOfflineThresholdHours() * 60;
            case "OCCUP":
                return thresholdConfig.getOccupOfflineThresholdHours() * 60;
            case "PIR_LIGHT":
                return thresholdConfig.getPirLightOfflineThresholdHours() * 60;
            case "COUNT":
                return thresholdConfig.getCountOfflineThresholdHours() * 60;
            
            // Continuous sensors: send data regularly
            default:
                return thresholdConfig.getDataMaxAgeMinutes();
        }
    }

    /**
     * Check for humidity alerts
     * Warning: > configured warning high or < configured warning low
     */
    private List<Alert> checkHumidityAlerts(String building) {
        List<Alert> alerts = new ArrayList<>();

        // Get all CO2 sensors that also have humidity data (multi-sensor devices)
        List<Sensor> co2Sensors = sensorDao.findAllByDeviceTypeAndBuilding(DEVICE_TYPE_CO2, building);
        // Also get dedicated humidity sensors
        List<Sensor> humiditySensors = sensorDao.findAllByDeviceTypeAndBuilding(DEVICE_TYPE_HUMIDITY, building);
        
        // Combine both lists
        List<Sensor> allHumiditySensors = new ArrayList<>();
        allHumiditySensors.addAll(co2Sensors); // CO2 sensors often have humidity
        allHumiditySensors.addAll(humiditySensors);

        for (Sensor sensor : allHumiditySensors) {
            Optional<SensorData> latestHumidity =
                    liveSensorCache.getLatest(sensor.getIdSensor(), PayloadValueType.HUMIDITY);
            
            // FALLBACK: If cache is empty, query database directly
            if (latestHumidity.isEmpty()) {
                latestHumidity = sensorDataDao.findLatestBySensorAndType(sensor.getIdSensor(), PayloadValueType.HUMIDITY);
            }

            if (latestHumidity.isPresent()) {
                SensorData data = latestHumidity.get();

                if (data.getReceivedAt()
                        .isAfter(LocalDateTime.now().minusMinutes(thresholdConfig.getDataMaxAgeMinutes()))) {
                    try {
                        double humidityValue = Double.parseDouble(data.getValueAsString());

                        if (humidityValue > thresholdConfig.getHumidity().getWarningHigh()
                                || humidityValue < thresholdConfig.getHumidity().getWarningLow()) {
                            alerts.add(new Alert(
                                    "warning",
                                    "💧",
                                    "Abnormal Humidity",
                                    String.format("Room %s humidity at %.0f%% (ideal range: %.0f-%.0f%%)",
                                            getRoomName(sensor.getIdSensor()), humidityValue,
                                            thresholdConfig.getHumidity().getWarningLow(),
                                            thresholdConfig.getHumidity().getWarningHigh()),
                                    formatTimeAgo(data.getReceivedAt())));
                        }
                    } catch (NumberFormatException e) {
                        log.warn("Invalid humidity value for sensor {}: {}", sensor.getIdSensor(),
                                data.getValueAsString());
                    }
                }
            }
        }

        return alerts;
    }

    /**
     * Check for noise level alerts
     * Warning: > configured warning threshold dB
     */
    private List<Alert> checkNoiseAlerts(String building) {
        List<Alert> alerts = new ArrayList<>();

        // Get all noise sensors from the database
        List<Sensor> noiseSensors = sensorDao.findAllByDeviceTypeAndBuilding(DEVICE_TYPE_NOISE, building);

        for (Sensor sensor : noiseSensors) {
            Optional<SensorData> latestNoise =
                    liveSensorCache.getLatest(sensor.getIdSensor(), PayloadValueType.LAEQ);
            
            // FALLBACK: If cache is empty, query database directly
            if (latestNoise.isEmpty()) {
                latestNoise = sensorDataDao.findLatestBySensorAndType(sensor.getIdSensor(), PayloadValueType.LAEQ);
            }

            if (latestNoise.isPresent()) {
                SensorData data = latestNoise.get();

                if (data.getReceivedAt()
                        .isAfter(LocalDateTime.now().minusMinutes(thresholdConfig.getDataMaxAgeMinutes()))) {
                    try {
                        double noiseValue = Double.parseDouble(data.getValueAsString());

                        if (noiseValue > thresholdConfig.getNoise().getWarning()) {
                            alerts.add(new Alert(
                                    "warning",
                                    "🔉",
                                    "High Noise Level",
                                    String.format("Room %s noise level at %.0f dB (threshold: %.0f dB)",
                                            getRoomName(sensor.getIdSensor()), noiseValue,
                                            thresholdConfig.getNoise().getWarning()),
                                    formatTimeAgo(data.getReceivedAt())));
                        }
                    } catch (NumberFormatException e) {
                        log.warn("Invalid noise value for sensor {}: {}", sensor.getIdSensor(),
                                data.getValueAsString());
                    }
                }
            }
        }

        return alerts;
    }

    /**
     * Check for gateway offline alerts
     * Alert if no data received from any sensor on a gateway within the configured time threshold
     */
    private List<Alert> checkGatewayOfflineAlerts() {
        List<Alert> alerts = new ArrayList<>();

        // Get all unique gateways from sensors
        List<String> gateways = sensorDao.findAllGateways();
        LocalDateTime cutoffTime = LocalDateTime.now().minusMinutes(thresholdConfig.getDataMaxAgeMinutes());

        log.debug("Checking gateway offline alerts with threshold: {} minutes (cutoff time: {})",
                thresholdConfig.getDataMaxAgeMinutes(), cutoffTime);

        for (String gatewayId : gateways) {
            if (gatewayId == null || gatewayId.trim().isEmpty()) {
                continue;
            }

            // Get the most recent data from any sensor on this gateway
            Optional<SensorData> latestData = sensorDataDao.findLatestByGateway(gatewayId);

            if (latestData.isPresent()) {
                SensorData data = latestData.get();
                long minutesAgo = java.time.Duration.between(data.getReceivedAt(), LocalDateTime.now()).toMinutes();

                // Check if the most recent data is older than the threshold
                if (data.getReceivedAt().isBefore(cutoffTime) || data.getReceivedAt().isEqual(cutoffTime)) {
                    log.debug("Gateway {} is offline: last data at {} ({} minutes ago, threshold: {} minutes)",
                            gatewayId, data.getReceivedAt(), minutesAgo, thresholdConfig.getDataMaxAgeMinutes());

                    alerts.add(new Alert(
                            "critical",
                            "📡",
                            "Gateway Offline",
                            String.format("Gateway %s not responding - no sensor data received", gatewayId),
                            formatTimeAgo(data.getReceivedAt())));
                } else {
                    log.trace("Gateway {} is online: last data at {} ({} minutes ago)",
                            gatewayId, data.getReceivedAt(), minutesAgo);
                }
            } else {
                // No data found at all for this gateway
                log.debug("Gateway {} has no data in database", gatewayId);

                alerts.add(new Alert(
                        "critical",
                        "📡",
                        "Gateway Offline",
                        String.format("Gateway %s not responding - no sensor data received", gatewayId),
                        "Never reported"));
            }
        }

        log.info("Found {} offline gateways (threshold: {} minutes)", alerts.size(),
                thresholdConfig.getDataMaxAgeMinutes());
        return alerts;
    }

    /**
     * Format timestamp as "X minutes/hours ago"
     */
    private String formatTimeAgo(LocalDateTime timestamp) {
        LocalDateTime now = LocalDateTime.now();
        long minutes = java.time.Duration.between(timestamp, now).toMinutes();

        // Handle edge cases (future timestamps due to clock skew)
        if (minutes < 0) {
            log.warn("Timestamp is in the future: {} vs now: {}", timestamp, now);
            return "just now";
        }

        if (minutes < 1) {
            return "just now";
        } else if (minutes < 60) {
            return minutes + " minutes ago";
        } else if (minutes < 1440) { // Less than 24 hours
            long hours = minutes / 60;
            return hours + (hours == 1 ? " hour ago" : " hours ago");
        } else {
            return timestamp.format(DateTimeFormatter.ofPattern("dd/MM HH:mm"));
        }
    }

    /**
     * Extract room name from sensor ID
     */
    private String getRoomName(String sensorId) {
        if (sensorId.contains("F1"))
            return "Floor 1";
        if (sensorId.contains("F2"))
            return "Floor 2";
        if (sensorId.contains("B1"))
            return "Basement";
        if (sensorId.contains("B2"))
            return "Basement 2";
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
                // logs
                .doOnSubscribe(sub ->
                        log.info("[Sensor] SSE SUBSCRIBED appId={} devices={}", appId, deviceIds))

                .doOnNext(raw ->
                        log.info("[Sensor] SSE RAW EVENT appId={} => {}", appId, raw))

                .doOnCancel(() ->
                        log.warn("[Sensor] SSE CANCELLED appId={}", appId))

                .doOnComplete(() ->
                        log.warn("[Sensor] SSE COMPLETED appId={}", appId))

                .doOnError(err ->
                        log.error("[Sensor] SSE multi error appId={}: {}",
                                appId, err.getMessage(), err))
                .doOnNext(this::parseAndUpdateCache);
    }


    private void parseAndUpdateCache(String payload) {
        log.error("🔥 PARSE CALLED 🔥");
        log.warn("SSE RAW PAYLOAD RECEIVED: {}", payload);
        try {
            log.info("SSE PAYLOAD RECEIVED");
            JsonNode root = objectMapper.readTree(payload);
            log.info("SSE Playload: ", root);
            JsonNode result = root.path("raw").path("result");
            if (result.isMissingNode()) {
                log.warn("No result node in payload");
                return;
            }

            String devEui = result
                    .path("end_device_ids")
                    .path("dev_eui")
                    .asText();

            if (devEui == null || devEui.isBlank()) {
                return;
            }

            String idSensor = sensorDao.findByDevEui(devEui)
                    .map(Sensor::getIdSensor)
                    .orElse(null);

            if (idSensor == null) {
                log.warn("No sensor found for devEui={}", devEui);
                return;
            }

            String receivedAtStr = result.path("received_at").asText();

            LocalDateTime receivedAt = OffsetDateTime
                    .parse(receivedAtStr)
                    .toLocalDateTime();

            JsonNode decoded = result
                    .path("uplink_message")
                    .path("decoded_payload");

            if (decoded.isMissingNode()) {
                return;
            }

            // Map pour lier payload → PayloadValueType
            Map<String, PayloadValueType> typeMapping = Map.of(
                    "co2", PayloadValueType.CO2,
                    "temperature", PayloadValueType.TEMPERATURE,
                    "humidity", PayloadValueType.HUMIDITY,
                    "laeq", PayloadValueType.LAEQ
            );

            // Parcourir toutes les clés connues
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

    public void startMonitoringForBuilding(String building, String sensorType, String dbBuildingName) {
        // Stop ancien stream si existe
        if (currentSubscription != null && !currentSubscription.isDisposed()) {
            currentSubscription.dispose();
        }

        String appId = mapBuildingToAppId(building);
        List<Sensor> sensors = sensorDao.findAllByDeviceTypeAndBuilding(sensorType, dbBuildingName);
        List<String> deviceIds  = sensors.stream()
                .map(Sensor::getIdSensor)
                .toList();

        currentSubscription = getMonitoringMany(appId, deviceIds )
                .subscribe();
    }


    private String mapBuildingToAppId(String building) {
        if (building == null || building.isBlank() || "all".equalsIgnoreCase(building)) {
            return "rpi-mantu-appli";
        }
        return switch (building.trim().toUpperCase()) {
            case "CHATEAUDUN", "CHÂTEAUDUN" -> "rpi-mantu-appli";
            case "LEVALLOIS" -> "lorawan-network-mantu";
            case "LILLE" -> "lil-rpi-mantu-appli";
            default -> building;
        };
    }


    public List<Alert> getCurrentAlertsWithWait(String building, int maxWaitMs) {
        int intervalMs = 100;
        int waited = 0;

        while (liveSensorCache.isEmpty(building) && waited < maxWaitMs) {
            try {
                Thread.sleep(intervalMs);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
            waited += intervalMs;
        }

        return getCurrentAlerts(building);
    }
}
