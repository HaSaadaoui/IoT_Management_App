package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.amaris.sensorprocessor.entity.Sensor;
import com.amaris.sensorprocessor.entity.SensorData;
import com.amaris.sensorprocessor.repository.SensorDao;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class LiveSensorCache {

    private final Map<String, Map<PayloadValueType, SensorData>> cache = new ConcurrentHashMap<>();
    private final SensorDao sensorDao;

    public LiveSensorCache(SensorDao sensorDao) {
        this.sensorDao = sensorDao;
    }


    public void updateSensorValue(String sensorId, PayloadValueType type, SensorData data) {
        cache.computeIfAbsent(sensorId, k -> new ConcurrentHashMap<>())
                .put(type, data);
        log.trace("CACHE PUT key={} type={}", sensorId, type);
    }

    public Optional<SensorData> getLatest(String sensorId, PayloadValueType type) {
        Map<PayloadValueType, SensorData> map = cache.get(sensorId);
        if (map == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(map.get(type));
    }

    public boolean isEmpty(String building) {
        // Vérifie si au moins un capteur du building a des données
        List<Sensor> sensors = sensorDao.findAllByBuilding(building); // tous les capteurs du building
        for (Sensor sensor : sensors) {
            for (PayloadValueType type : PayloadValueType.values()) {
                if (getLatest(sensor.getIdSensor(), type).isPresent()) {
                    return false; // au moins une donnée existe
                }
            }
        }
        return true; // pas de données pour aucun capteur
    }



    public void clear() {
        cache.clear();
    }

}

