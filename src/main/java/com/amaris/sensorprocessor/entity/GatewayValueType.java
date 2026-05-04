package com.amaris.sensorprocessor.entity;

import java.util.EnumSet;
import java.util.Set;

public enum GatewayValueType {
    HOSTNAME,
    IP_LOCAL,
    IP_PUBLIC,
    CPU_PERCENT,
    CPU_TEMP,
    RAM_TOTAL_GB,
    RAM_USED_GB,
    DISK_TOTAL,
    DISK_USED,
    DISK_AVAILABLE,
    DISK_USAGE_PERCENT,
    UPTIME_DAYS,
    GATEWAY_STATUS,
    DEVICE_COUNT,
    GATEWAY_NAME,
    GATEWAY_CREATED_AT,
    LOCATION_LATITUDE,
    LOCATION_LONGITUDE,
    LOCATION_ALTITUDE,
    LOCATION_SOURCE,
    DATABASE_LOCATION;

    public static final Set<GatewayValueType> HISTORY_TYPES = EnumSet.of(
            CPU_PERCENT,
            CPU_TEMP,
            RAM_USED_GB,
            DISK_USAGE_PERCENT,
            GATEWAY_STATUS,
            DEVICE_COUNT
    );
}
