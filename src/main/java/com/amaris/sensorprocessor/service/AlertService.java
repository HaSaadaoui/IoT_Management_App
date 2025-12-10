package com.amaris.sensorprocessor.service;

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

    // ===== ALERT THRESHOLDS (EASY TO MODIFY FOR DEMO) =====
    // To change thresholds for demo purposes, simply modify these constants:
    //
    // CO2 thresholds (ppm) - Lowered for easy triggering in demo
    private static final double CO2_CRITICAL_THRESHOLD = 600.0;  // Originally 1200
    private static final double CO2_WARNING_THRESHOLD = 400.0;   // Originally 800
    //
    // Temperature thresholds (°C) - Comfortable room temp ranges
    private static final double TEMP_CRITICAL_HIGH = 25.0;       // Originally 30
    private static final double TEMP_CRITICAL_LOW = 20.0;        // Originally 15
    private static final double TEMP_WARNING_HIGH = 23.0;        // Originally 26
    private static final double TEMP_WARNING_LOW = 18.0;         // Originally 18
    //
    // Humidity thresholds (%) - Typical indoor ranges
    private static final double HUMIDITY_WARNING_HIGH = 60.0;    // Originally 70
    private static final double HUMIDITY_WARNING_LOW = 40.0;     // Originally 30
    //
    // Noise threshold (dB) - Office noise levels
    private static final double NOISE_WARNING_THRESHOLD = 50.0;  // Originally 70

    private final SensorDataDao sensorDataDao;
    private final SensorDao sensorDao;

    @Autowired
    public AlertService(SensorDataDao sensorDataDao, SensorDao sensorDao) {
        this.sensorDataDao = sensorDataDao;
        this.sensorDao = sensorDao;
    }

    /**
     * Generate alerts based on current sensor data
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

        // If no real alerts, add test alerts for development/demo purposes
        if (alerts.isEmpty()) {
            alerts.add(new Alert(
                "warning",
                "⚠️",
                "High CO2 Level Detected",
                "Sensor CO2-B2 in Meeting Room A detected 850 ppm CO2 level",
                "5 minutes ago"
            ));

            alerts.add(new Alert(
                "critical",
                "🌡️",
                "Temperature Alert",
                "Room F1-02 temperature reached 29°C - ventilation recommended",
                "12 minutes ago"
            ));

            alerts.add(new Alert(
                "info",
                "ℹ️",
                "Sensor Offline",
                "Motion sensor MOTION-F1-05 has not reported data for 2 hours",
                "2 hours ago"
            ));
        }

        return alerts;
    }

    /**
     * Check for CO2 level alerts
     * Critical: > CO2_CRITICAL_THRESHOLD ppm
     * Warning: > CO2_WARNING_THRESHOLD ppm
     */
    private List<Alert> checkCO2Alerts() {
        List<Alert> alerts = new ArrayList<>();

        // Get all CO2 sensors from the database
        List<Sensor> co2Sensors = sensorDao.findAllByDeviceType("CO2");

        for (Sensor sensor : co2Sensors) {
            Optional<SensorData> latestCO2 = sensorDataDao.findLatestBySensorAndType(sensor.getIdSensor(), PayloadValueType.CO2);

            if (latestCO2.isPresent()) {
                SensorData data = latestCO2.get();

                // Only consider recent readings (within last 30 minutes)
                if (data.getReceivedAt().isAfter(LocalDateTime.now().minusMinutes(30))) {
                    try {
                        double co2Value = Double.parseDouble(data.getValueAsString());

                        if (co2Value > CO2_CRITICAL_THRESHOLD) {
                            alerts.add(new Alert(
                                "critical",
                                "⚠️",
                                "Critical CO2 Level",
                                String.format("Sensor %s detected %.0f ppm (threshold: %.0f ppm)", sensor.getIdSensor(), co2Value, CO2_CRITICAL_THRESHOLD),
                                formatTimeAgo(data.getReceivedAt())
                            ));
                        } else if (co2Value > CO2_WARNING_THRESHOLD) {
                            alerts.add(new Alert(
                                "warning",
                                "🔔",
                                "High CO2 Level",
                                String.format("Sensor %s detected %.0f ppm (threshold: %.0f ppm)", sensor.getIdSensor(), co2Value, CO2_WARNING_THRESHOLD),
                                formatTimeAgo(data.getReceivedAt())
                            ));
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
     * Critical: > TEMP_CRITICAL_HIGH°C or < TEMP_CRITICAL_LOW°C
     * Warning: > TEMP_WARNING_HIGH°C or < TEMP_WARNING_LOW°C
     */
    private List<Alert> checkTemperatureAlerts() {
        List<Alert> alerts = new ArrayList<>();

        // Get all temperature sensors from the database
        List<Sensor> tempSensors = sensorDao.findAllByDeviceType("TEMP");

        for (Sensor sensor : tempSensors) {
            Optional<SensorData> latestTemp = sensorDataDao.findLatestBySensorAndType(sensor.getIdSensor(), PayloadValueType.TEMPERATURE);

            if (latestTemp.isPresent()) {
                SensorData data = latestTemp.get();

                if (data.getReceivedAt().isAfter(LocalDateTime.now().minusMinutes(30))) {
                    try {
                        double tempValue = Double.parseDouble(data.getValueAsString());

                        if (tempValue > TEMP_CRITICAL_HIGH || tempValue < TEMP_CRITICAL_LOW) {
                            alerts.add(new Alert(
                                "critical",
                                "🌡️",
                                "Critical Temperature",
                                String.format("Room %s temperature at %.1f°C (critical range: %.1f-%.1f°C)", getRoomName(sensor.getIdSensor()), tempValue, TEMP_CRITICAL_LOW, TEMP_CRITICAL_HIGH),
                                formatTimeAgo(data.getReceivedAt())
                            ));
                        } else if (tempValue > TEMP_WARNING_HIGH || tempValue < TEMP_WARNING_LOW) {
                            alerts.add(new Alert(
                                "warning",
                                "🌡️",
                                "Uncomfortable Temperature",
                                String.format("Room %s temperature at %.1f°C (comfort range: %.1f-%.1f°C)", getRoomName(sensor.getIdSensor()), tempValue, TEMP_WARNING_LOW, TEMP_WARNING_HIGH),
                                formatTimeAgo(data.getReceivedAt())
                            ));
                        }
                    } catch (NumberFormatException e) {
                        log.warn("Invalid temperature value for sensor {}: {}", sensor.getIdSensor(), data.getValueAsString());
                    }
                }
            }
        }

        return alerts;
    }

    /**
     * Check for sensor offline alerts
     * Alert if no data received in the last 30 minutes
     */
    private List<Alert> checkSensorOfflineAlerts() {
        List<Alert> alerts = new ArrayList<>();

        // Get all sensors from the database
        List<Sensor> allSensors = sensorDao.findAllSensors();

        for (Sensor sensor : allSensors) {
            String sensorId = sensor.getIdSensor();
            String deviceType = sensor.getDeviceType();

            // Check for any type of recent data from this sensor
            boolean hasRecentData = false;
            String lastSeenTime = "Never reported";

            // First try the expected data type based on device type
            PayloadValueType dataType = getDataTypeForDeviceType(deviceType);
            if (dataType != null) {
                Optional<SensorData> latestData = sensorDataDao.findLatestBySensorAndType(sensorId, dataType);
                if (latestData.isPresent()) {
                    SensorData data = latestData.get();
                    lastSeenTime = formatTimeAgo(data.getReceivedAt());

                    if (data.getReceivedAt().isAfter(LocalDateTime.now().minusMinutes(30))) {
                        hasRecentData = true;
                    }
                }
            }

            // If no data found with expected type, try to find ANY data from this sensor
            if (lastSeenTime.equals("Never reported")) {
                Optional<SensorData> anyLatestData = sensorDataDao.findLatestBySensor(sensorId);
                if (anyLatestData.isPresent()) {
                    SensorData data = anyLatestData.get();
                    lastSeenTime = formatTimeAgo(data.getReceivedAt());

                    if (data.getReceivedAt().isAfter(LocalDateTime.now().minusMinutes(30))) {
                        hasRecentData = true;
                    }
                }
            }

            if (!hasRecentData) {
                alerts.add(new Alert(
                    "info",
                    "ℹ️",
                    "Sensor Offline",
                    String.format("%s (%s) not responding", sensorId, deviceType),
                    lastSeenTime
                ));
            }
        }

        return alerts;
    }

    /**
     * Check for humidity alerts
     * Warning: > HUMIDITY_WARNING_HIGH% or < HUMIDITY_WARNING_LOW%
     */
    private List<Alert> checkHumidityAlerts() {
        List<Alert> alerts = new ArrayList<>();

        // Get all humidity sensors from the database
        List<Sensor> humiditySensors = sensorDao.findAllByDeviceType("HUMIDITY");

        for (Sensor sensor : humiditySensors) {
            Optional<SensorData> latestHumidity = sensorDataDao.findLatestBySensorAndType(sensor.getIdSensor(), PayloadValueType.HUMIDITY);

            if (latestHumidity.isPresent()) {
                SensorData data = latestHumidity.get();

                if (data.getReceivedAt().isAfter(LocalDateTime.now().minusMinutes(30))) {
                    try {
                        double humidityValue = Double.parseDouble(data.getValueAsString());

                        if (humidityValue > HUMIDITY_WARNING_HIGH || humidityValue < HUMIDITY_WARNING_LOW) {
                            alerts.add(new Alert(
                                "warning",
                                "💧",
                                "Abnormal Humidity",
                                String.format("Room %s humidity at %.0f%% (ideal range: %.0f-%.0f%%)", getRoomName(sensor.getIdSensor()), humidityValue, HUMIDITY_WARNING_LOW, HUMIDITY_WARNING_HIGH),
                                formatTimeAgo(data.getReceivedAt())
                            ));
                        }
                    } catch (NumberFormatException e) {
                        log.warn("Invalid humidity value for sensor {}: {}", sensor.getIdSensor(), data.getValueAsString());
                    }
                }
            }
        }

        return alerts;
    }

    /**
     * Check for noise level alerts
     * Warning: > NOISE_WARNING_THRESHOLD dB
     */
    private List<Alert> checkNoiseAlerts() {
        List<Alert> alerts = new ArrayList<>();

        // Get all noise sensors from the database
        List<Sensor> noiseSensors = sensorDao.findAllByDeviceType("NOISE");

        for (Sensor sensor : noiseSensors) {
            Optional<SensorData> latestNoise = sensorDataDao.findLatestBySensorAndType(sensor.getIdSensor(), PayloadValueType.LAEQ);

            if (latestNoise.isPresent()) {
                SensorData data = latestNoise.get();

                if (data.getReceivedAt().isAfter(LocalDateTime.now().minusMinutes(30))) {
                    try {
                        double noiseValue = Double.parseDouble(data.getValueAsString());

                        if (noiseValue > NOISE_WARNING_THRESHOLD) {
                            alerts.add(new Alert(
                                "warning",
                                "🔉",
                                "High Noise Level",
                                String.format("Room %s noise level at %.0f dB (threshold: %.0f dB)", getRoomName(sensor.getIdSensor()), noiseValue, NOISE_WARNING_THRESHOLD),
                                formatTimeAgo(data.getReceivedAt())
                            ));
                        }
                    } catch (NumberFormatException e) {
                        log.warn("Invalid noise value for sensor {}: {}", sensor.getIdSensor(), data.getValueAsString());
                    }
                }
            }
        }

        return alerts;
    }

    /**
     * Format timestamp as "X minutes/hours ago"
     */
    private String formatTimeAgo(LocalDateTime timestamp) {
        LocalDateTime now = LocalDateTime.now();
        long minutes = java.time.Duration.between(timestamp, now).toMinutes();

        if (minutes < 60) {
            return minutes + " minutes ago";
        } else if (minutes < 1440) { // Less than 24 hours
            long hours = minutes / 60;
            return hours + " hours ago";
        } else {
            return timestamp.format(DateTimeFormatter.ofPattern("dd/MM HH:mm"));
        }
    }

    /**
     * Extract room name from sensor ID
     */
    private String getRoomName(String sensorId) {
        if (sensorId.contains("F1")) return "Floor 1";
        if (sensorId.contains("F2")) return "Floor 2";
        if (sensorId.contains("B1")) return "Basement";
        if (sensorId.contains("B2")) return "Floor 2";
        return sensorId;
    }

    /**
     * Determine the expected data type for a sensor based on its device type
     */
    private PayloadValueType getDataTypeForDeviceType(String deviceType) {
        if (deviceType == null) return null;

        switch (deviceType.toUpperCase()) {
            case "CO2": return PayloadValueType.CO2;
            case "TEMP": case "TEMPERATURE": return PayloadValueType.TEMPERATURE;
            case "HUMIDITY": return PayloadValueType.HUMIDITY;
            case "NOISE": return PayloadValueType.LAEQ;
            case "LIGHT": case "ILLUMINANCE": return PayloadValueType.ILLUMINANCE;
            case "MOTION": return PayloadValueType.MOTION;
            case "DESK": case "OCCUPANCY": return PayloadValueType.OCCUPANCY;
            default: return null;
        }
    }

    /**
     * Determine the expected data type for a sensor based on its ID (legacy method)
     */
    private PayloadValueType getSensorDataType(String sensorId) {
        if (sensorId.startsWith("CO2")) return PayloadValueType.CO2;
        if (sensorId.startsWith("TEMP")) return PayloadValueType.TEMPERATURE;
        if (sensorId.startsWith("HUMID")) return PayloadValueType.HUMIDITY;
        if (sensorId.startsWith("NOISE")) return PayloadValueType.LAEQ;
        if (sensorId.startsWith("LIGHT")) return PayloadValueType.ILLUMINANCE;
        if (sensorId.startsWith("MOTION")) return PayloadValueType.MOTION;
        return null;
    }
}
