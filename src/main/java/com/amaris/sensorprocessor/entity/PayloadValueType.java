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
    /*
     * result.end_device_ids
     * result.end_device_ids.application_ids
     * result.end_device_ids.application_ids.application_id
     * result.end_device_ids.dev_addr
     * result.end_device_ids.dev_eui
     * result.end_device_ids.device_id
     * result.received_at
     * result.uplink_message
     * result.uplink_message.confirmed
     * result.uplink_message.consumed_airtime
     * result.uplink_message.decoded_payload
     * result.uplink_message.decoded_payload.LAI
     * result.uplink_message.decoded_payload.LAImax
     * result.uplink_message.decoded_payload.LAeq
     * result.uplink_message.decoded_payload.battery
     * result.uplink_message.decoded_payload.co2
     * result.uplink_message.decoded_payload.distance
     * result.uplink_message.decoded_payload.humidity
     * result.uplink_message.decoded_payload.illuminance
     * result.uplink_message.decoded_payload.light
     * result.uplink_message.decoded_payload.motion
     * result.uplink_message.decoded_payload.occupancy
     * result.uplink_message.decoded_payload.period_in
     * result.uplink_message.decoded_payload.period_out
     * result.uplink_message.decoded_payload.temperature
     * result.uplink_message.decoded_payload.vdd
     * result.uplink_message.f_cnt
     * result.uplink_message.f_port
     * result.uplink_message.frm_payload
     * result.uplink_message.last_battery_percentage
     * result.uplink_message.last_battery_percentage.f_cnt
     * result.uplink_message.last_battery_percentage.received_at
     * result.uplink_message.last_battery_percentage.value
     * result.uplink_message.network_ids
     * result.uplink_message.network_ids.cluster_address
     * result.uplink_message.network_ids.cluster_id
     * result.uplink_message.network_ids.net_id
     * result.uplink_message.network_ids.ns_id
     * result.uplink_message.network_ids.tenant_id
     * result.uplink_message.packet_error_rate
     * result.uplink_message.received_at
     * result.uplink_message.rx_metadata
     * result.uplink_message.rx_metadata.[0]
     * result.uplink_message.rx_metadata.[0].channel_index
     * result.uplink_message.rx_metadata.[0].channel_rssi
     * result.uplink_message.rx_metadata.[0].frequency_offset
     * result.uplink_message.rx_metadata.[0].gateway_ids
     * result.uplink_message.rx_metadata.[0].gateway_ids.eui
     * result.uplink_message.rx_metadata.[0].gateway_ids.gateway_id
     * result.uplink_message.rx_metadata.[0].gps_time
     * result.uplink_message.rx_metadata.[0].location
     * result.uplink_message.rx_metadata.[0].location.altitude
     * result.uplink_message.rx_metadata.[0].location.latitude
     * result.uplink_message.rx_metadata.[0].location.longitude
     * result.uplink_message.rx_metadata.[0].location.source
     * result.uplink_message.rx_metadata.[0].received_at
     * result.uplink_message.rx_metadata.[0].rssi
     * result.uplink_message.rx_metadata.[0].snr
     * result.uplink_message.rx_metadata.[0].time
     * result.uplink_message.rx_metadata.[0].timestamp
     * result.uplink_message.settings
     * result.uplink_message.settings.data_rate
     * result.uplink_message.settings.data_rate.lora
     * result.uplink_message.settings.data_rate.lora.bandwidth
     * result.uplink_message.settings.data_rate.lora.coding_rate
     * result.uplink_message.settings.data_rate.lora.spreading_factor
     * result.uplink_message.settings.frequency
     * result.uplink_message.settings.time
     * result.uplink_message.settings.timestamp
     */
    
    UNKNOWN(null),
    APPLICATION_ID("$.result.end_device_ids.application_ids.application_id"),
    BATTERY("$.result.uplink_message.decoded_payload.battery"),
    CHANNEL_INDEX("$.result.uplink_message.rx_metadata.[0].channel_index"),
    CHANNEL_RSSI("$.result.uplink_message.rx_metadata.[0].channel_rssi"),
    CO2("$.result.uplink_message.decoded_payload.co2"),
    CONFIRMED("$.result.uplink_message.confirmed"),
    CONSUMED_AIRTIME("$.result.uplink_message.consumed_airtime"),
    DEV_ADDR("$.result.end_device_ids.dev_addr"),
    DEV_EUI("$.result.end_device_ids.dev_eui"),
    DEVICE_ID("$.result.end_device_ids.device_id"),
    DISTANCE("$.result.uplink_message.decoded_payload.distance"),
    F_CNT("$.result.uplink_message.f_cnt"),
    F_PORT("$.result.uplink_message.f_port"),
    FREQUENCY_OFFSET("$.result.uplink_message.rx_metadata.[0].frequency_offset"),
    FRM_PAYLOAD("$.result.uplink_message.frm_payload"),
    GPS_TIME("$.result.uplink_message.rx_metadata.[0].gps_time"),
    HUMIDITY("$.result.uplink_message.decoded_payload.humidity"),
    ILLUMINANCE("$.result.uplink_message.decoded_payload.illuminance"),
    LAEQ("$.result.uplink_message.decoded_payload.LAeq"),
    LAI("$.result.uplink_message.decoded_payload.LAI"),
    LAIMAX("$.result.uplink_message.decoded_payload.LAImax"),
    LAST_BATTERY_PERCENTAGE_F_CNT("$.result.uplink_message.last_battery_percentage.f_cnt"),
    LAST_BATTERY_PERCENTAGE_RECEIVED_AT("$.result.uplink_message.last_battery_percentage.received_at"),
    LAST_BATTERY_PERCENTAGE_VALUE("$.result.uplink_message.last_battery_percentage.value"),
    LAST_BATTERY_PERCENTAGE("$.result.uplink_message.last_battery_percentage.value"),
    LIGHT("$.result.uplink_message.decoded_payload.light"),
    LOCATION_ALTITUDE("$.result.uplink_message.rx_metadata.[0].location.altitude"),
    LOCATION_LATITUDE("$.result.uplink_message.rx_metadata.[0].location.latitude"),
    LOCATION_LONGITUDE("$.result.uplink_message.rx_metadata.[0].location.longitude"),
    LOCATION_SOURCE("$.result.uplink_message.rx_metadata.[0].location.source"),
    LORA_BANDWIDTH("$.result.uplink_message.settings.data_rate.lora.bandwidth"),
    LORA_CODING_RATE("$.result.uplink_message.settings.data_rate.lora.coding_rate"),
    LORA_SPREADING_FACTOR("$.result.uplink_message.settings.data_rate.lora.spreading_factor"),
    MOTION("$.result.uplink_message.decoded_payload.motion"),
    NETWORK_CLUSTER_ADDRESS("$.result.uplink_message.network_ids.cluster_address"),
    NETWORK_CLUSTER_ID("$.result.uplink_message.network_ids.cluster_id"),
    NETWORK_NET_ID("$.result.uplink_message.network_ids.net_id"),
    NETWORK_NS_ID("$.result.uplink_message.network_ids.ns_id"),
    NETWORK_TENANT_ID("$.result.uplink_message.network_ids.tenant_id"),
    OCCUPANCY("$.result.uplink_message.decoded_payload.occupancy"),
    PACKET_ERROR_RATE("$.result.uplink_message.packet_error_rate"),
    PERIOD_IN("$.result.uplink_message.decoded_payload.period_in"),
    PERIOD_OUT("$.result.uplink_message.decoded_payload.period_out"),
    RECEIVED_AT("$.result.received_at"),
    RSSI("$.result.uplink_message.rx_metadata.[0].rssi"),
    SETTINGS_FREQUENCY("$.result.uplink_message.settings.frequency"),
    SETTINGS_TIME("$.result.uplink_message.settings.time"),
    SETTINGS_TIMESTAMP("$.result.uplink_message.settings.timestamp"),
    SNR("$.result.uplink_message.rx_metadata.[0].snr"),
    TEMPERATURE("$.result.uplink_message.decoded_payload.temperature"),
    TIME("$.result.uplink_message.rx_metadata.[0].time"),
    TIMESTAMP("$.result.uplink_message.rx_metadata.[0].timestamp"),
    VDD("$.result.uplink_message.decoded_payload.vdd");

    /**
     * jsonPath permet au décodeur de payload d'associer dynamiquement le type de
     * donnée avec le chemin JSON lors de l'ingestion depuis TTN
     */
    private final String jsonPath;
}
