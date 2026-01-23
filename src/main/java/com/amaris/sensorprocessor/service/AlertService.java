package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.config.AlertThresholdConfig;
import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.amaris.sensorprocessor.entity.Sensor;
import com.amaris.sensorprocessor.entity.SensorData;
import com.amaris.sensorprocessor.model.dashboard.Alert;
import com.amaris.sensorprocessor.repository.SensorDao;
import com.amaris.sensorprocessor.repository.SensorDataDao;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
public class AlertService {

    // Device type constants
    private static final String DEVICE_TYPE_CO2 = "CO2";
    private static final String DEVICE_TYPE_TEMP = "TEMP";
    private static final String DEVICE_TYPE_HUMIDITY = "HUMIDITY";
    private static final String DEVICE_TYPE_NOISE = "NOISE";

    private final SensorDataDao sensorDataDao;
    private final SensorDao sensorDao;
    private final AlertThresholdConfig thresholdConfig;

    @Autowired
    public AlertService(SensorDataDao sensorDataDao, SensorDao sensorDao, AlertThresholdConfig thresholdConfig) {
        this.sensorDataDao = sensorDataDao;
        this.sensorDao = sensorDao;
        this.thresholdConfig = thresholdConfig;
    }

    /**
     * Generate alerts based on current sensor data
     * 
     * @return List of active alerts
     */
    public List<Alert> getCurrentAlerts() {
        List<Alert> alerts = new ArrayList<>();

        // Check for CO2 alerts
        alerts.addAll(checkCO2Alerts());

        // Check for temperature alerts
        alerts.addAll(checkTemperatureAlerts());

        // Check for sensor offline alerts
        alerts.addAll(checkSensorOfflineAlerts());

        // Check for humidity alerts
        alerts.addAll(checkHumidityAlerts());

        // Check for noise alerts
        alerts.addAll(checkNoiseAlerts());

        // Check for gateway offline alerts - DISABLED due to connection leak
        // alerts.addAll(checkGatewayOfflineAlerts());

        return alerts;
    }

    /**
     * Check for CO2 level alerts
     * Critical: > configured critical threshold ppm
     * Warning: > configured warning threshold ppm
     */
    private List<Alert> checkCO2Alerts() {
        List<Alert> alerts = new ArrayList<>();

        // Get all CO2 sensors from the database
        List<Sensor> co2Sensors = sensorDao.findAllByDeviceType(DEVICE_TYPE_CO2);

        for (Sensor sensor : co2Sensors) {
            Optional<SensorData> latestCO2 = sensorDataDao.findLatestBySensorAndType(sensor.getIdSensor(),
                    PayloadValueType.CO2);

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
    private List<Alert> checkTemperatureAlerts() {
        List<Alert> alerts = new ArrayList<>();

        // Get all CO2 sensors that also have temperature data (multi-sensor devices)
        List<Sensor> co2Sensors = sensorDao.findAllByDeviceType(DEVICE_TYPE_CO2);
        // Also get dedicated temperature sensors
        List<Sensor> tempSensors = sensorDao.findAllByDeviceType(DEVICE_TYPE_TEMP);
        
        // Combine both lists
        List<Sensor> allTempSensors = new ArrayList<>();
        allTempSensors.addAll(co2Sensors); // CO2 sensors often have temperature
        allTempSensors.addAll(tempSensors);

        for (Sensor sensor : allTempSensors) {
            Optional<SensorData> latestTemp = sensorDataDao.findLatestBySensorAndType(sensor.getIdSensor(),
                    PayloadValueType.TEMPERATURE);

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
    private List<Alert> checkSensorOfflineAlerts() {
        List<Alert> alerts = new ArrayList<>();

        // Get all sensors from the database
        List<Sensor> allSensors = sensorDao.findAllSensors();

        log.info("🔍 Checking {} sensors for offline alerts. DESK threshold: {}h, default: {}min",
                allSensors.size(), 
                thresholdConfig.getDeskOfflineThresholdHours(),
                thresholdConfig.getDataMaxAgeMinutes());

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
                    log.info("⚠️ OFFLINE: {} ({}) - last: {} min ago, threshold: {} min",
                            sensorId, deviceType, minutesAgo, thresholdMinutes);

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

        log.info("✅ Found {} offline sensors (DESK: {}, Other: {}) using device-specific thresholds", 
                alerts.size(), deskCount, otherCount);
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
    private List<Alert> checkHumidityAlerts() {
        List<Alert> alerts = new ArrayList<>();

        // Get all CO2 sensors that also have humidity data (multi-sensor devices)
        List<Sensor> co2Sensors = sensorDao.findAllByDeviceType(DEVICE_TYPE_CO2);
        // Also get dedicated humidity sensors
        List<Sensor> humiditySensors = sensorDao.findAllByDeviceType(DEVICE_TYPE_HUMIDITY);
        
        // Combine both lists
        List<Sensor> allHumiditySensors = new ArrayList<>();
        allHumiditySensors.addAll(co2Sensors); // CO2 sensors often have humidity
        allHumiditySensors.addAll(humiditySensors);

        for (Sensor sensor : allHumiditySensors) {
            Optional<SensorData> latestHumidity = sensorDataDao.findLatestBySensorAndType(sensor.getIdSensor(),
                    PayloadValueType.HUMIDITY);

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
    private List<Alert> checkNoiseAlerts() {
        List<Alert> alerts = new ArrayList<>();

        // Get all noise sensors from the database
        List<Sensor> noiseSensors = sensorDao.findAllByDeviceType(DEVICE_TYPE_NOISE);

        for (Sensor sensor : noiseSensors) {
            Optional<SensorData> latestNoise = sensorDataDao.findLatestBySensorAndType(sensor.getIdSensor(),
                    PayloadValueType.LAEQ);

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

    /**
     * Determine the expected data type for a sensor based on its device type
     */
    private PayloadValueType getDataTypeForDeviceType(String deviceType) {
        if (deviceType == null)
            return null;

        switch (deviceType.toUpperCase()) {
            case "CO2":
                return PayloadValueType.CO2;
            case "TEMP":
            case "TEMPERATURE":
                return PayloadValueType.TEMPERATURE;
            case "HUMIDITY":
                return PayloadValueType.HUMIDITY;
            case "NOISE":
                return PayloadValueType.LAEQ;
            case "LIGHT":
            case "ILLUMINANCE":
                return PayloadValueType.ILLUMINANCE;
            case "MOTION":
                return PayloadValueType.MOTION;
            case "DESK":
            case "OCCUPANCY":
                return PayloadValueType.OCCUPANCY;
            default:
                return null;
        }
    }

    /**
     * Determine the expected data type for a sensor based on its ID (legacy method)
     */
    private PayloadValueType getSensorDataType(String sensorId) {
        if (sensorId == null)
            return null;

        String upperSensorId = sensorId.toUpperCase();
        if (upperSensorId.startsWith("CO2"))
            return PayloadValueType.CO2;
        if (upperSensorId.startsWith("TEMP"))
            return PayloadValueType.TEMPERATURE;
        if (upperSensorId.startsWith("HUMID"))
            return PayloadValueType.HUMIDITY;
        if (upperSensorId.startsWith("NOISE"))
            return PayloadValueType.LAEQ;
        if (upperSensorId.startsWith("LIGHT"))
            return PayloadValueType.ILLUMINANCE;
        if (upperSensorId.startsWith("MOTION"))
            return PayloadValueType.MOTION;
        return null;
    }
}
