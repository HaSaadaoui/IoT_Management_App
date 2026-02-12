package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.amaris.sensorprocessor.entity.SensorData;
import org.springframework.stereotype.Service;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class LiveSensorCache {

    private final Map<String, Map<PayloadValueType, SensorData>> cache = new ConcurrentHashMap<>();

    public void updateSensorValue(String sensorId, PayloadValueType type, SensorData data) {
        cache.computeIfAbsent(sensorId, k -> new ConcurrentHashMap<>())
                .put(type, data);
        log.info("CACHE PUT key={} type={}", sensorId, type);

    }

    public Optional<SensorData> getLatest(String sensorId, PayloadValueType type) {
        log.info("CACHE GET key={} type={}", sensorId, type);
        log.info("Available keys in cache: {}", cache.keySet());

        Map<PayloadValueType, SensorData> map = cache.get(sensorId);
        if (map == null) {
            log.warn("No entry for key '{}'", sensorId);
            return Optional.empty();
        }

        SensorData data = map.get(type);
        if (data == null) {
            log.warn("Key '{}' exists but type '{}' is missing. Available types: {}", sensorId, type, map.keySet());
        } else {
            log.info("CACHE HIT: {}", data);
        }
        return Optional.ofNullable(data);
    }

    public void clear() {
        cache.clear();
    }

}

