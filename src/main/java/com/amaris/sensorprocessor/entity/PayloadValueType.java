package com.amaris.sensorprocessor.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 
 * Les enums dans cette liste doivent concorder avec les enums
 * de MySQL sensor_data.value_type.
 * 
 * jsonPath permet au décodeur de payload d'associer dynamiquement le type de
 * donnée avec le chemin JSON lors de l'ingestion depuis TTN
 *
 */
@Getter
@RequiredArgsConstructor
public enum PayloadValueType {

    UNKNOWN(null),
    APPLICATION_ID("$.end_device_ids.application_ids.application_id"),
    BATTERY("$.uplink_message.decoded_payload.battery"),
    CHANNEL_INDEX("$.uplink_message.rx_metadata.[0].channel_index"),
    CHANNEL_RSSI("$.uplink_message.rx_metadata.[0].channel_rssi"),
    CO2("$.uplink_message.decoded_payload.co2"),
    CONFIRMED("$.uplink_message.confirmed"),
    CONSUMED_AIRTIME("$.uplink_message.consumed_airtime"),
    DEV_ADDR("$.end_device_ids.dev_addr"),
    DEV_EUI("$.end_device_ids.dev_eui"),
    DEVICE_ID("$.end_device_ids.device_id"),
    DISTANCE("$.uplink_message.decoded_payload.distance"),
    F_CNT("$.uplink_message.f_cnt"),
    F_PORT("$.uplink_message.f_port"),
    FREQUENCY_OFFSET("$.uplink_message.rx_metadata.[0].frequency_offset"),
    FRM_PAYLOAD("$.uplink_message.frm_payload"),
    GPS_TIME("$.uplink_message.rx_metadata.[0].gps_time"),
    HUMIDITY("$.uplink_message.decoded_payload.humidity"),
    ILLUMINANCE("$.uplink_message.decoded_payload.illuminance"),
    LAEQ("$.uplink_message.decoded_payload.LAeq"),
    LAI("$.uplink_message.decoded_payload.LAI"),
    LAIMAX("$.uplink_message.decoded_payload.LAImax"),
    LAST_BATTERY_PERCENTAGE_F_CNT("$.uplink_message.last_battery_percentage.f_cnt"),
    LAST_BATTERY_PERCENTAGE_RECEIVED_AT("$.uplink_message.last_battery_percentage.received_at"),
    LAST_BATTERY_PERCENTAGE_VALUE("$.uplink_message.last_battery_percentage.value"),
    LAST_BATTERY_PERCENTAGE("$.uplink_message.last_battery_percentage.value"), // TODO: check if we remove
    LIGHT("$.uplink_message.decoded_payload.light"),
    LOCATION_ALTITUDE("$.uplink_message.rx_metadata.[0].location.altitude"),
    LOCATION_LATITUDE("$.uplink_message.rx_metadata.[0].location.latitude"),
    LOCATION_LONGITUDE("$.uplink_message.rx_metadata.[0].location.longitude"),
    LOCATION_SOURCE("$.uplink_message.rx_metadata.[0].location.source"),
    LORA_BANDWIDTH("$.uplink_message.settings.data_rate.lora.bandwidth"),
    LORA_CODING_RATE("$.uplink_message.settings.data_rate.lora.coding_rate"),
    LORA_SPREADING_FACTOR("$.uplink_message.settings.data_rate.lora.spreading_factor"),
    MOTION("$.uplink_message.decoded_payload.motion"),
    NETWORK_CLUSTER_ADDRESS("$.uplink_message.network_ids.cluster_address"),
    NETWORK_CLUSTER_ID("$.uplink_message.network_ids.cluster_id"),
    NETWORK_NET_ID("$.uplink_message.network_ids.net_id"),
    NETWORK_NS_ID("$.uplink_message.network_ids.ns_id"),
    NETWORK_TENANT_ID("$.uplink_message.network_ids.tenant_id"),
    OCCUPANCY("$.uplink_message.decoded_payload.occupancy"),
    PACKET_ERROR_RATE("$.uplink_message.packet_error_rate"),
    PERIOD_IN("$.uplink_message.decoded_payload.period_in"),
    PERIOD_OUT("$.uplink_message.decoded_payload.period_out"),
    RECEIVED_AT("$.received_at"),
    RSSI("$.uplink_message.rx_metadata.[0].rssi"),
    SETTINGS_FREQUENCY("$.uplink_message.settings.frequency"),
    SETTINGS_TIME("$.uplink_message.settings.time"),
    SETTINGS_TIMESTAMP("$.uplink_message.settings.timestamp"),
    SNR("$.uplink_message.rx_metadata.[0].snr"),
    TEMPERATURE("$.uplink_message.decoded_payload.temperature"),
    TIME("$.uplink_message.rx_metadata.[0].time"),
    TIMESTAMP("$.uplink_message.rx_metadata.[0].timestamp"),
    VDD("$.uplink_message.decoded_payload.vdd"),
    DAYLIGHT("$.uplink_message.decoded_payload.daylight"),
    PIR("$.uplink_message.decoded_payload.pir"),

    CONSUMPTION_CHANNEL_0("$.uplink_message.decoded_payload.[\"0\"].value"),
    CONSUMPTION_CHANNEL_1("$.uplink_message.decoded_payload.[\"1\"].value"),
    CONSUMPTION_CHANNEL_2("$.uplink_message.decoded_payload.[\"2\"].value"),
    CONSUMPTION_CHANNEL_3("$.uplink_message.decoded_payload.[\"3\"].value"),
    CONSUMPTION_CHANNEL_4("$.uplink_message.decoded_payload.[\"4\"].value"),
    CONSUMPTION_CHANNEL_5("$.uplink_message.decoded_payload.[\"5\"].value"),
    CONSUMPTION_CHANNEL_6("$.uplink_message.decoded_payload.[\"6\"].value"),
    CONSUMPTION_CHANNEL_7("$.uplink_message.decoded_payload.[\"7\"].value"),
    CONSUMPTION_CHANNEL_8("$.uplink_message.decoded_payload.[\"8\"].value"),
    CONSUMPTION_CHANNEL_9("$.uplink_message.decoded_payload.[\"9\"].value"),
    CONSUMPTION_CHANNEL_10("$.uplink_message.decoded_payload.[\"10\"].value"),
    CONSUMPTION_CHANNEL_11("$.uplink_message.decoded_payload.[\"11\"].value"),
    CONSUMPTION_CHANNEL_12("$.uplink_message.decoded_payload.[\"12\"].value"),
    CONSUMPTION_CHANNEL_13("$.uplink_message.decoded_payload.[\"13\"].value"),
    CONSUMPTION_CHANNEL_14("$.uplink_message.decoded_payload.[\"14\"].value"),
    CONSUMPTION_CHANNEL_15("$.uplink_message.decoded_payload.[\"15\"].value"),
    CONSUMPTION_CHANNEL_16("$.uplink_message.decoded_payload.[\"16\"].value");
    
    /**
     * jsonPath permet au décodeur de payload d'associer dynamiquement le type de
     * donnée avec le chemin JSON lors de l'ingestion depuis TTN
     */
    private final String jsonPath;
    
}
