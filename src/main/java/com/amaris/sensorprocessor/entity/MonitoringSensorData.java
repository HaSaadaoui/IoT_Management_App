package com.amaris.sensorprocessor.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.time.Instant;
import java.util.Map;
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class MonitoringSensorData {

    /** Horodatage ISO de la dernière trame */
    private String timestamp;

    @JsonProperty("ids")
    private Ids ids;

    @JsonProperty("link")
    private LinkInfo link;

    @JsonProperty("payload")
    private Payload payload;

    @JsonProperty("network")
    private NetworkInfo network;

    @JsonProperty("raw")
    private Raw raw;

    /* ===================== Sous-structures ===================== */

    @Data
    public static class Ids {
        @JsonProperty("application_id")
        private String applicationId;
        @JsonProperty("device_id")
        private String deviceId;
        @JsonProperty("dev_eui")
        private String devEui;
        @JsonProperty("join_eui")
        private String joinEui;
        @JsonProperty("dev_addr")
        private String devAddr;
        @JsonProperty("profile")
        private String profile;
    }

    @Data
    public static class LinkInfo {
        @JsonProperty("f_port")
        private Integer fPort;
        @JsonProperty("f_cnt")
        private Integer fCnt;
        @JsonProperty("gateway_id")
        private String gatewayId;
        @JsonProperty("rssi (dBm)")
        private Double rssi;
        @JsonProperty("snr (dB)")
        private Double snr;
        @JsonProperty("sf")
        private String spreadingFactor;
        @JsonProperty("bw (kHz)")
        private Integer bandwidthKhz;
        @JsonProperty("coding_rate")
        private String codingRate;
        @JsonProperty("frequency (MHz)")
        private Double frequencyMhz;
        @JsonProperty("airtime")
        private String consumedAirtime;
        @JsonProperty("channel_index")
        private Integer channelIndex;
        @JsonProperty("location")
        private Location location;

        @Data
        public static class Location {
            private Double latitude;
            private Double longitude;
            private Integer altitude;
            private String source;
        }
    }

    @Data
    public static class Payload {
        /**
         * Champs normalisés pour l’UI :
         *  - presence : "occupied"/"vacant" OU "motion"/"normal" OU 0/1/2...
         *  - light    : "bright"/"dim"/"daylight"...
         *  - battery  : pourcentage si dispo (0..100)
         *  - temperature (°C)
         *  - humidity (%)
         *  - vdd (mV)
         *  - period_in / period_out : temps (s) ou compteurs selon capteur
         */
        @JsonProperty("presence")
        private Object presence;

        @JsonProperty("light")
        private Object light;

        @JsonProperty("battery (%)")
        private Double battery;

        @JsonProperty("temperature (°C)")
        private Double temperature;

        @JsonProperty("co2 (ppm)")
        private Double co2Ppm;

        @JsonProperty("LAeq (dB)")
        private Double laeqDb;

        @JsonProperty("LAI (dB)")
        private Double laiDb;

        @JsonProperty("LAImax (dB)")
        private Double laiMaxDb;

        @JsonProperty("humidity (%)")
        private Double humidity;

        @JsonProperty("vdd (mV)")
        private Double vdd;

        @JsonProperty("period_in")
        private Double periodIn;

        @JsonProperty("period_out")
        private Double periodOut;

        @JsonProperty("energy_data")
        private Map<String, Object> energyData;
    }

    @Data
    public static class NetworkInfo {
        @JsonProperty("net_id")
        private String netId;
        @JsonProperty("ns_id")
        private String nsId;
        @JsonProperty("tenant_id")
        private String tenantId;
        @JsonProperty("cluster_id")
        private String clusterId;
        @JsonProperty("cluster_address")
        private String clusterAddress;
    }

    @Data
    public static class Raw {
        @JsonProperty("decoded_payload")
        private Map<String, Object> decodedPayload;
        @JsonProperty("frm_payload_b64")
        private String frmPayloadBase64;
    }

    public static MonitoringSensorData now() {
        MonitoringSensorData d = new MonitoringSensorData();
        d.setTimestamp(Instant.now().toString());
        return d;
    }
}
