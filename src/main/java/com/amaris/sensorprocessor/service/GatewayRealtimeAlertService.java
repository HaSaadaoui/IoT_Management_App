package com.amaris.sensorprocessor.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Real-time gateway alerting service without database persistence
 * Processes monitoring data and generates alerts on-the-fly
 */
@Service
public class GatewayRealtimeAlertService {

    private static final Logger log = LoggerFactory.getLogger(GatewayRealtimeAlertService.class);

    // Configurable thresholds
    @Value("${gateway.alerts.cpu.warning:75.0}")
    private double cpuWarningThreshold;

    @Value("${gateway.alerts.cpu.critical:90.0}")
    private double cpuCriticalThreshold;

    @Value("${gateway.alerts.ram.warning:80.0}")
    private double ramWarningThreshold;

    @Value("${gateway.alerts.ram.critical:95.0}")
    private double ramCriticalThreshold;

    @Value("${gateway.alerts.disk.warning:85.0}")
    private double diskWarningThreshold;

    @Value("${gateway.alerts.disk.critical:95.0}")
    private double diskCriticalThreshold;

    @Value("${gateway.alerts.temperature.warning:70.0}")
    private double temperatureWarningThreshold;

    @Value("${gateway.alerts.temperature.critical:80.0}")
    private double temperatureCriticalThreshold;

    /**
     * Process gateway monitoring data and return current alerts
     */
    public List<GatewayAlert> processMonitoringData(String gatewayId, String gatewayName, Map<String, Object> systemData) {
        List<GatewayAlert> currentAlerts = new ArrayList<>();
        
        try {
            log.debug("Processing real-time gateway data for alerts: {}", gatewayId);

            // Check Status
            GatewayAlert statusAlert = checkGatewayStatus(gatewayId, gatewayName, systemData);
            if (statusAlert != null) currentAlerts.add(statusAlert);
            
            // Check CPU Usage
            GatewayAlert cpuAlert = checkCpuUsage(gatewayId, gatewayName, systemData);
            if (cpuAlert != null) currentAlerts.add(cpuAlert);
            
            // Check RAM Usage
            GatewayAlert ramAlert = checkRamUsage(gatewayId, gatewayName, systemData);
            if (ramAlert != null) currentAlerts.add(ramAlert);
            
            // Check Disk Usage
            GatewayAlert diskAlert = checkDiskUsage(gatewayId, gatewayName, systemData);
            if (diskAlert != null) currentAlerts.add(diskAlert);
            
            // Check Temperature
            GatewayAlert tempAlert = checkTemperature(gatewayId, gatewayName, systemData);
            if (tempAlert != null) currentAlerts.add(tempAlert);
            
            log.debug("Generated {} real-time alerts for gateway: {}", currentAlerts.size(), gatewayId);
            
        } catch (Exception e) {
            log.error("Error processing gateway data for real-time alerts: {}", e.getMessage(), e);
        }
        
        return currentAlerts;
    }

    /**
     * Check gateway status (active/inactive)
     */
    private GatewayAlert checkGatewayStatus(String gatewayId, String gatewayName, Map<String, Object> systemData) {
        Object statusObj = systemData.get("gateway_status");
        if (statusObj == null) return null;

        String status = statusObj.toString();
        
        if (!"active".equalsIgnoreCase(status)) {
            return new GatewayAlert(
                gatewayId, gatewayName, "STATUS", "CRITICAL",
                String.format("Gateway %s is %s", gatewayName, status),
                0.0, 1.0, "status", "🔌"
            );
        }
        return null;
    }

    /**
     * Check CPU usage
     */
    private GatewayAlert checkCpuUsage(String gatewayId, String gatewayName, Map<String, Object> systemData) {
        Object cpuObj = systemData.get("cpu_percent (%)");
        if (cpuObj == null) return null;

        double cpuUsage = Double.parseDouble(cpuObj.toString());
        
        if (cpuUsage >= cpuCriticalThreshold) {
            return new GatewayAlert(
                gatewayId, gatewayName, "CPU", "CRITICAL",
                String.format("Critical CPU usage: %.1f%%", cpuUsage),
                cpuUsage, cpuCriticalThreshold, "%", "⚡"
            );
        } else if (cpuUsage >= cpuWarningThreshold) {
            return new GatewayAlert(
                gatewayId, gatewayName, "CPU", "WARNING",
                String.format("High CPU usage: %.1f%%", cpuUsage),
                cpuUsage, cpuWarningThreshold, "%", "⚡"
            );
        }
        return null;
    }

    /**
     * Check RAM usage
     */
    private GatewayAlert checkRamUsage(String gatewayId, String gatewayName, Map<String, Object> systemData) {
        Object ramTotalObj = systemData.get("ram_total_gb (GB)");
        Object ramUsedObj = systemData.get("ram_used_gb (GB)");
        
        if (ramTotalObj == null || ramUsedObj == null) return null;

        double ramTotal = Double.parseDouble(ramTotalObj.toString());
        double ramUsed = Double.parseDouble(ramUsedObj.toString());
        double ramUsagePercent = (ramUsed / ramTotal) * 100;
        
        if (ramUsagePercent >= ramCriticalThreshold) {
            return new GatewayAlert(
                gatewayId, gatewayName, "RAM", "CRITICAL",
                String.format("Critical RAM usage: %.1f%% (%.2f/%.2f GB)", ramUsagePercent, ramUsed, ramTotal),
                ramUsagePercent, ramCriticalThreshold, "%", "💾"
            );
        } else if (ramUsagePercent >= ramWarningThreshold) {
            return new GatewayAlert(
                gatewayId, gatewayName, "RAM", "WARNING",
                String.format("High RAM usage: %.1f%% (%.2f/%.2f GB)", ramUsagePercent, ramUsed, ramTotal),
                ramUsagePercent, ramWarningThreshold, "%", "💾"
            );
        }
        return null;
    }

    /**
     * Check disk usage
     */
    private GatewayAlert checkDiskUsage(String gatewayId, String gatewayName, Map<String, Object> systemData) {
        Object diskUsageObj = systemData.get("disk_usage_percent");
        if (diskUsageObj == null) return null;

        String diskUsageStr = diskUsageObj.toString().replace("%", "");
        double diskUsage = Double.parseDouble(diskUsageStr);
        
        if (diskUsage >= diskCriticalThreshold) {
            return new GatewayAlert(
                gatewayId, gatewayName, "DISK", "CRITICAL",
                String.format("Critical disk usage: %.1f%%", diskUsage),
                diskUsage, diskCriticalThreshold, "%", "💿"
            );
        } else if (diskUsage >= diskWarningThreshold) {
            return new GatewayAlert(
                gatewayId, gatewayName, "DISK", "WARNING",
                String.format("High disk usage: %.1f%%", diskUsage),
                diskUsage, diskWarningThreshold, "%", "💿"
            );
        }
        return null;
    }

    /**
     * Check CPU temperature
     */
    private GatewayAlert checkTemperature(String gatewayId, String gatewayName, Map<String, Object> systemData) {
        Object tempObj = systemData.get("cpu_temp (C)");
        if (tempObj == null) return null;

        double temperature = Double.parseDouble(tempObj.toString());
        
        if (temperature >= temperatureCriticalThreshold) {
            return new GatewayAlert(
                gatewayId, gatewayName, "TEMPERATURE", "CRITICAL",
                String.format("Critical temperature: %.1f°C", temperature),
                temperature, temperatureCriticalThreshold, "°C", "🌡️"
            );
        } else if (temperature >= temperatureWarningThreshold) {
            return new GatewayAlert(
                gatewayId, gatewayName, "TEMPERATURE", "WARNING",
                String.format("High temperature: %.1f°C", temperature),
                temperature, temperatureWarningThreshold, "°C", "🌡️"
            );
        }
        return null;
    }

    /**
     * Simple alert class for real-time alerts (no persistence)
     */
    public static class GatewayAlert {
        private final String gatewayId;
        private final String gatewayName;
        private final String alertType;
        private final String severity;
        private final String message;
        private final Double currentValue;
        private final Double thresholdValue;
        private final String unit;
        private final String icon;
        private final long timestamp;

        public GatewayAlert(String gatewayId, String gatewayName, String alertType, String severity, 
                           String message, Double currentValue, Double thresholdValue, String unit, String icon) {
            this.gatewayId = gatewayId;
            this.gatewayName = gatewayName;
            this.alertType = alertType;
            this.severity = severity;
            this.message = message;
            this.currentValue = currentValue;
            this.thresholdValue = thresholdValue;
            this.unit = unit;
            this.icon = icon;
            this.timestamp = System.currentTimeMillis();
        }

        // Getters
        public String getGatewayId() { return gatewayId; }
        public String getGatewayName() { return gatewayName; }
        public String getAlertType() { return alertType; }
        public String getSeverity() { return severity; }
        public String getMessage() { return message; }
        public Double getCurrentValue() { return currentValue; }
        public Double getThresholdValue() { return thresholdValue; }
        public String getUnit() { return unit; }
        public String getIcon() { return icon; }
        public long getTimestamp() { return timestamp; }
    }
}
