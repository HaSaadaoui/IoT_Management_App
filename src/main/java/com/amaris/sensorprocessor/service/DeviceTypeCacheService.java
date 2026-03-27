package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.DeviceType;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.stream.Collectors;

@Service
public class DeviceTypeCacheService {

    private final DeviceTypeService deviceTypeService;

    public DeviceTypeCacheService(DeviceTypeService deviceTypeService) {
        this.deviceTypeService = deviceTypeService;
    }

    @Cacheable("deviceTypeMap")
    public Map<Integer, String> loadDeviceTypeMap() {
        return deviceTypeService.findAll().stream()
                .collect(Collectors.toMap(DeviceType::getIdDeviceType, DeviceType::getLabel));
    }
}
