package com.amaris.sensorprocessor.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

/**
 * DTO pour parser la réponse TTN GET /applications/{app}/devices
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class TtnDeviceInfo {

    @JsonProperty("end_devices")
    private List<EndDevice> endDevices;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class EndDevice {
        private Ids ids;
        
        @JsonProperty("created_at")
        private String createdAt;
        
        private String name;
        private String description;
        
        @JsonProperty("network_server_address")
        private String networkServerAddress;
        
        @JsonProperty("application_server_address")
        private String applicationServerAddress;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Ids {
        @JsonProperty("device_id")
        private String deviceId;
        
        @JsonProperty("application_ids")
        private ApplicationIds applicationIds;
        
        @JsonProperty("dev_eui")
        private String devEui;
        
        @JsonProperty("join_eui")
        private String joinEui;
        
        @JsonProperty("dev_addr")
        private String devAddr;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ApplicationIds {
        @JsonProperty("application_id")
        private String applicationId;
    }
}
