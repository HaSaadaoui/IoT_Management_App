package com.amaris.sensorprocessor.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class MonitoringGatewayData {

    private String timestamp;
    private SystemInfo system;

    @JsonProperty("gateway_info")
    private GatewayInfo gatewayInfo;

    private DatabaseInfo database;

    @JsonProperty("devices")
    private List<DeviceInfo> devices;

    @Data
    public static class SystemInfo {
        private String hostname;

        @JsonProperty("ip_local")
        private String ipLocal;

        @JsonProperty("ip_public")
        private String ipPublic;

        @JsonProperty("cpu_percent (%)")
        private double cpuPercent;

        @JsonProperty("cpu_temp (C)")
        private double cpuTemp;

        @JsonProperty("ram_total_gb (GB)")
        private double ramTotalGb;

        @JsonProperty("ram_used_gb (GB)")
        private double ramUsedGb;

        @JsonProperty("disk_total")
        private String diskTotal;

        @JsonProperty("disk_used")
        private String diskUsed;

        @JsonProperty("disk_available")
        private String diskAvailable;

        @JsonProperty("disk_usage_percent")
        private String diskUsagePercent;

        @JsonProperty("uptime_days")
        private String uptimeDays;

        @JsonProperty("gateway_status")
        private String gatewayStatus;
    }

    @Data
    public static class GatewayInfo {
        @JsonProperty("name")
        private String name;

        @JsonProperty("created_at")
        private String createdAt;

        private Location location;

        @Data
        public static class Location {
            private double latitude;
            private double longitude;
            private int altitude;
            private String source;
        }
    }

    @Data
    public static class DatabaseInfo {
        private String location;
    }

    @Data
    public static class DeviceInfo {
        @JsonProperty("device_id")
        private String deviceId;

        @JsonProperty("application_id")
        private String applicationId;
    }

}
