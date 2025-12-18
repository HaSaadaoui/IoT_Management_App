package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.SensorThreshold;
import com.amaris.sensorprocessor.repository.SensorThresholdDao;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
public class SensorThresholdService {

    private final SensorThresholdDao sensorThresholdDao;

    @Autowired
    public SensorThresholdService(SensorThresholdDao sensorThresholdDao) {
        this.sensorThresholdDao = sensorThresholdDao;
    }

    @PostConstruct
    public void init() {
        sensorThresholdDao.createTableIfNotExists();
    }

    public void saveThreshold(SensorThreshold threshold) {
        sensorThresholdDao.save(threshold);
        log.info("Saved threshold for sensor {} and parameter {}", 
                threshold.getSensorId(), threshold.getParameterType());
    }

    public List<SensorThreshold> getThresholdsForSensor(String sensorId) {
        return sensorThresholdDao.findBySensorId(sensorId);
    }

    public Optional<SensorThreshold> getThresholdForSensorAndParameter(String sensorId, String parameterType) {
        return sensorThresholdDao.findBySensorAndParameter(sensorId, parameterType);
    }

    public List<SensorThreshold> getAllThresholds() {
        return sensorThresholdDao.findAll();
    }

    public void deleteThreshold(String id) {
        sensorThresholdDao.delete(id);
    }
    
    public Optional<SensorThreshold> getThresholdById(String id) {
        return sensorThresholdDao.findById(id);
    }

    public boolean hasCustomThreshold(String sensorId, String parameterType) {
        Optional<SensorThreshold> threshold = sensorThresholdDao.findBySensorAndParameter(sensorId, parameterType);
        return threshold.isPresent() && threshold.get().isEnabled();
    }
}
