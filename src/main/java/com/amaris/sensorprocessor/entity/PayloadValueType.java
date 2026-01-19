package com.amaris.sensorprocessor.entity;

import lombok.Getter;


@Getter
public enum PayloadValueType {

    /* =====================================================
     * 🟢 MÉTIER — UNIQUEMENT CE QUI A DU SENS FONCTIONNEL
     * ===================================================== */

    TEMPERATURE(Category.BUSINESS, "$.uplink_message.decoded_payload.temperature"),
    HUMIDITY(Category.BUSINESS, "$.uplink_message.decoded_payload.humidity"),
    CO2(Category.BUSINESS, "$.uplink_message.decoded_payload.co2"),
    OCCUPANCY(Category.BUSINESS, "$.uplink_message.decoded_payload.occupancy"),
    LIGHT(Category.BUSINESS, "$.uplink_message.decoded_payload.light"),
    ILLUMINANCE(Category.BUSINESS, "$.uplink_message.decoded_payload.illuminance"),
    MOTION(Category.BUSINESS, "$.uplink_message.decoded_payload.motion"),
    PIR(Category.BUSINESS, "$.uplink_message.decoded_payload.pir"),
    DAYLIGHT(Category.BUSINESS, "$.uplink_message.decoded_payload.daylight"),
    LAEQ(Category.BUSINESS, "$.uplink_message.decoded_payload.LAeq"),
    DISTANCE(Category.BUSINESS, "$.uplink_message.decoded_payload.distance"),
    BATTERY(Category.BUSINESS, "$.uplink_message.decoded_payload.battery"),
    VDD(Category.BUSINESS, "$.uplink_message.decoded_payload.vdd"),

    ENERGY_CHANNEL_0 (Category.BUSINESS, "$.uplink_message.decoded_payload[\"0\"].value"),
    ENERGY_CHANNEL_1 (Category.BUSINESS, "$.uplink_message.decoded_payload[\"1\"].value"),
    ENERGY_CHANNEL_2 (Category.BUSINESS, "$.uplink_message.decoded_payload[\"2\"].value"),
    ENERGY_CHANNEL_3 (Category.BUSINESS, "$.uplink_message.decoded_payload[\"3\"].value"),
    ENERGY_CHANNEL_4 (Category.BUSINESS, "$.uplink_message.decoded_payload[\"4\"].value"),
    ENERGY_CHANNEL_5 (Category.BUSINESS, "$.uplink_message.decoded_payload[\"5\"].value"),
    ENERGY_CHANNEL_6 (Category.BUSINESS, "$.uplink_message.decoded_payload[\"6\"].value"),
    ENERGY_CHANNEL_7 (Category.BUSINESS, "$.uplink_message.decoded_payload[\"7\"].value"),
    ENERGY_CHANNEL_8 (Category.BUSINESS, "$.uplink_message.decoded_payload[\"8\"].value"),
    ENERGY_CHANNEL_9 (Category.BUSINESS, "$.uplink_message.decoded_payload[\"9\"].value"),
    ENERGY_CHANNEL_10(Category.BUSINESS, "$.uplink_message.decoded_payload[\"10\"].value"),
    ENERGY_CHANNEL_11(Category.BUSINESS, "$.uplink_message.decoded_payload[\"11\"].value"),

    POWER_TOTAL(Category.BUSINESS, null),
    ENERGY_TOTAL(Category.BUSINESS, null),

    POWER_CHANNEL_0 (Category.BUSINESS, "$.uplink_message.decoded_payload[\"12\"].value"),
    POWER_CHANNEL_1 (Category.BUSINESS, "$.uplink_message.decoded_payload[\"13\"].value"),
    POWER_CHANNEL_2 (Category.BUSINESS, "$.uplink_message.decoded_payload[\"14\"].value"),
    POWER_CHANNEL_3 (Category.BUSINESS, "$.uplink_message.decoded_payload[\"15\"].value"),
    POWER_CHANNEL_4 (Category.BUSINESS, "$.uplink_message.decoded_payload[\"16\"].value"),
    POWER_CHANNEL_5 (Category.BUSINESS, "$.uplink_message.decoded_payload[\"17\"].value"),
    POWER_CHANNEL_6 (Category.BUSINESS, "$.uplink_message.decoded_payload[\"18\"].value"),
    POWER_CHANNEL_7 (Category.BUSINESS, "$.uplink_message.decoded_payload[\"19\"].value"),
    POWER_CHANNEL_8 (Category.BUSINESS, "$.uplink_message.decoded_payload[\"20\"].value"),
    POWER_CHANNEL_9 (Category.BUSINESS, "$.uplink_message.decoded_payload[\"21\"].value"),
    POWER_CHANNEL_10(Category.BUSINESS, "$.uplink_message.decoded_payload[\"22\"].value"),
    POWER_CHANNEL_11(Category.BUSINESS, "$.uplink_message.decoded_payload[\"23\"].value"),


    /* =====================================================
     * ⚙️ TECHNIQUE — DEBUG / RÉSEAU / TTN
     * ===================================================== */

    APPLICATION_ID(Category.TECH, "$.end_device_ids.application_ids.application_id"),
    DEVICE_ID(Category.TECH, "$.end_device_ids.device_id"),
    DEV_EUI(Category.TECH, "$.end_device_ids.dev_eui"),
    DEV_ADDR(Category.TECH, "$.end_device_ids.dev_addr"),
    RECEIVED_AT(Category.TECH, "$.received_at"),

    RSSI(Category.BUSINESS, "$.uplink_message.rx_metadata.[0].rssi"),
    SNR(Category.BUSINESS, "$.uplink_message.rx_metadata.[0].snr"),
    CHANNEL_INDEX(Category.BUSINESS, "$.uplink_message.rx_metadata.[0].channel_index"),
    CHANNEL_RSSI(Category.BUSINESS, "$.uplink_message.rx_metadata.[0].channel_rssi"),
    FREQUENCY_OFFSET(Category.TECH, "$.uplink_message.rx_metadata.[0].frequency_offset"),

    F_CNT(Category.TECH, "$.uplink_message.f_cnt"),
    F_PORT(Category.TECH, "$.uplink_message.f_port"),
    CONFIRMED(Category.TECH, "$.uplink_message.confirmed"),
    CONSUMED_AIRTIME(Category.TECH, "$.uplink_message.consumed_airtime"),
    FRM_PAYLOAD(Category.TECH, "$.uplink_message.frm_payload"),

    LOCATION_ALTITUDE(Category.TECH, "$.uplink_message.rx_metadata.[0].location.altitude"),
    LOCATION_LATITUDE(Category.TECH, "$.uplink_message.rx_metadata.[0].location.latitude"),
    LOCATION_LONGITUDE(Category.TECH, "$.uplink_message.rx_metadata.[0].location.longitude"),
    LOCATION_SOURCE(Category.TECH, "$.uplink_message.rx_metadata.[0].location.source"),

    SETTINGS_FREQUENCY(Category.TECH, "$.uplink_message.settings.frequency"),
    SETTINGS_TIME(Category.TECH, "$.uplink_message.settings.time"),
    SETTINGS_TIMESTAMP(Category.TECH, "$.uplink_message.settings.timestamp"),
    LORA_BANDWIDTH(Category.TECH, "$.uplink_message.settings.data_rate.lora.bandwidth"),
    LORA_CODING_RATE(Category.TECH, "$.uplink_message.settings.data_rate.lora.coding_rate"),
    LORA_SPREADING_FACTOR(Category.TECH, "$.uplink_message.settings.data_rate.lora.spreading_factor"),

    NETWORK_CLUSTER_ADDRESS(Category.TECH, "$.uplink_message.network_ids.cluster_address"),
    NETWORK_CLUSTER_ID(Category.TECH, "$.uplink_message.network_ids.cluster_id"),
    NETWORK_NET_ID(Category.TECH, "$.uplink_message.network_ids.net_id"),
    NETWORK_NS_ID(Category.TECH, "$.uplink_message.network_ids.ns_id"),
    NETWORK_TENANT_ID(Category.TECH, "$.uplink_message.network_ids.tenant_id"),

    UNKNOWN(Category.TECH, null);

    /* =====================================================
     * STRUCTURE
     * ===================================================== */

    public enum Category {
        BUSINESS,
        TECH
    }

    private final Category category;
    private final String jsonPath;

    PayloadValueType(Category category, String jsonPath) {
        this.category = category;
        this.jsonPath = jsonPath;
    }

    public boolean isBusiness() {
        return category == Category.BUSINESS;
    }

    public static final java.util.Set<PayloadValueType> BUSINESS_TYPES =
            java.util.Arrays.stream(values())
                    .filter(PayloadValueType::isBusiness)
                    .collect(java.util.stream.Collectors.toCollection(
                            () -> java.util.EnumSet.noneOf(PayloadValueType.class)
                    ));
}
