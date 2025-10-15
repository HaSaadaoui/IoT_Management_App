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
    private String timestamp; // ex: Instant.now().toString()

    /** Identifiants du device / application */
    @JsonProperty("ids")
    private Ids ids;

    /** Infos radio / link-level (data rate, RSSI/SNR, fréquence, etc.) */
    @JsonProperty("link")
    private LinkInfo link;

    /** Charge utile normalisée pour l’UI (quel que soit le capteur) */
    @JsonProperty("payload")
    private Payload payload;

    /** Infos réseau TTN (facultatif, utile pour debug) */
    @JsonProperty("network")
    private NetworkInfo network;

    /** Copie minimale brute pour debug (decoded_payload, frm_payload, etc.) */
    @JsonProperty("raw")
    private Raw raw;

    /* ===================== Sous-structures ===================== */

    @Data
    public static class Ids {
        @JsonProperty("application_id")
        private String applicationId;   // ex: rpi-mantu-appli

        @JsonProperty("device_id")
        private String deviceId;        // ex: pir-light-01-01

        @JsonProperty("dev_eui")
        private String devEui;

        @JsonProperty("join_eui")
        private String joinEui;

        @JsonProperty("dev_addr")
        private String devAddr;

        /** Profil déduit (ex: PIR_LIGHT / VS70_OCCUPANCY / DESK_TEXT / GENERIC) */
        @JsonProperty("profile")
        private String profile;
    }

    @Data
    public static class LinkInfo {
        /* Compteurs LoRaWAN */
        @JsonProperty("f_port")
        private Integer fPort;

        @JsonProperty("f_cnt")
        private Integer fCnt;

        /* Radio : qualité de réception */
        @JsonProperty("gateway_id")
        private String gatewayId;

        @JsonProperty("rssi (dBm)")
        private Double rssi;

        @JsonProperty("snr (dB)")
        private Double snr;

        /* Data rate / fréquence */
        @JsonProperty("sf")
        private String spreadingFactor; // ex: "SF7"

        @JsonProperty("bw (kHz)")
        private Integer bandwidthKhz;   // ex: 125

        @JsonProperty("coding_rate")
        private String codingRate;      // ex: "4/5"

        @JsonProperty("frequency (MHz)")
        private Double frequencyMhz;    // ex: 867.1

        /* Divers */
        @JsonProperty("airtime")
        private String consumedAirtime; // ex: "0.056576s"

        @JsonProperty("channel_index")
        private Integer channelIndex;

        /* Localisation de la GW qui a reçu (si dispo) */
        @JsonProperty("location")
        private Location location;

        @Data
        public static class Location {
            private Double latitude;
            private Double longitude;
            private Integer altitude;
            private String source;      // ex: SOURCE_REGISTRY
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
         */
        @JsonProperty("presence")
        private Object presence;

        @JsonProperty("light")
        private Object light;

        @JsonProperty("battery (%)")
        private Double battery;

        @JsonProperty("temperature (°C)")
        private Double temperature;

        @JsonProperty("humidity (%)")
        private Double humidity;

        @JsonProperty("vdd (mV)")
        private Double vdd;
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
        /** Payload TTN décodé brut (clé/valeurs tels que TTN les fournit) */
        @JsonProperty("decoded_payload")
        private Map<String, Object> decodedPayload;

        /** Base64 du payload non décodé (frm_payload) */
        @JsonProperty("frm_payload_b64")
        private String frmPayloadBase64;
    }

    /* ===================== Helpers (facultatif) ===================== */

    public static MonitoringSensorData now() {
        MonitoringSensorData d = new MonitoringSensorData();
        d.setTimestamp(Instant.now().toString());
        return d;
    }
}
