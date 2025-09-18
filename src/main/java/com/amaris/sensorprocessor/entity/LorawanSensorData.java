package com.amaris.sensorprocessor.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.Map;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LorawanSensorData {

    @JsonProperty("end_device")
    private EndDevice endDevice;

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class EndDevice {
        private Ids ids;
        private Boolean supportsJoin;

        // adresses cluster TTN (eu1.cloud.thethings.network)
        private String networkServerAddress;
        private String applicationServerAddress;
        private String joinServerAddress;

        // LoRaWAN versions
        private String lorawanVersion;      // ex: "1.0.3"
        private String lorawanPhyVersion;   // ex: "1.0.3-a"

        // clés OTAA
        private RootKeys rootKeys;

        // optionnels
        private String name;
        private Map<String, String> attributes;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Ids {
        private String deviceId;  // only lowercase [a-z0-9-]
        private String devEui;    // 16 hex
        private String joinEui;   // 16 hex
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class RootKeys {
        @JsonProperty("app_key")
        private Key appKey;

        // Pour LoRaWAN 1.0.x, nwk_key n’est pas requise. On la laisse optionnelle.
        @JsonProperty("nwk_key")
        private Key nwkKey;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Key {
        private String key; // 32 hex (16 octets)
    }
}
