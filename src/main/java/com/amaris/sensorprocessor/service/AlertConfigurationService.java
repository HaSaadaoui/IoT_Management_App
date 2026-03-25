package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.config.AlertThresholdConfig;
import com.amaris.sensorprocessor.entity.AlertConfigEntity;
import com.amaris.sensorprocessor.repository.AlertConfigurationDao;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PostConstruct;

@Service
public class AlertConfigurationService {

    private final AlertThresholdConfig alertThresholdConfig;
    private final AlertConfigurationDao alertConfigurationDao;

    @Autowired
    public AlertConfigurationService(AlertThresholdConfig alertThresholdConfig, AlertConfigurationDao alertConfigurationDao) {
        this.alertThresholdConfig = alertThresholdConfig;
        this.alertConfigurationDao = alertConfigurationDao;
    }

    @PostConstruct
    public void init() {
        alertConfigurationDao.createTableIfNotExists();
        
        AlertConfigEntity entity = alertConfigurationDao.load();
        if (entity == null) {
            // Seed DB with defaults from the bean (loaded from properties)
            entity = new AlertConfigEntity();
            entity.setId(1L);
            entity.setDataMaxAgeMinutes(alertThresholdConfig.getDataMaxAgeMinutes());
            
            entity.setCo2Critical(alertThresholdConfig.getCo2().getCritical());
            entity.setCo2Warning(alertThresholdConfig.getCo2().getWarning());
            
            entity.setTempCriticalHigh(alertThresholdConfig.getTemperature().getCriticalHigh());
            entity.setTempCriticalLow(alertThresholdConfig.getTemperature().getCriticalLow());
            entity.setTempWarningHigh(alertThresholdConfig.getTemperature().getWarningHigh());
            entity.setTempWarningLow(alertThresholdConfig.getTemperature().getWarningLow());
            
            entity.setHumidityWarningHigh(alertThresholdConfig.getHumidity().getWarningHigh());
            entity.setHumidityWarningLow(alertThresholdConfig.getHumidity().getWarningLow());
            
            entity.setNoiseWarning(alertThresholdConfig.getNoise().getWarning());
            
            alertConfigurationDao.save(entity);
        } else {
            // Update bean from DB
            updateBeanFromEntity(entity);
        }
    }

    @Transactional
    public void saveConfig(AlertThresholdConfig newConfig) {
        // Update DB
        AlertConfigEntity entity = new AlertConfigEntity();
        entity.setId(1L);
        entity.setDataMaxAgeMinutes(newConfig.getDataMaxAgeMinutes());
        
        entity.setCo2Critical(newConfig.getCo2().getCritical());
        entity.setCo2Warning(newConfig.getCo2().getWarning());
        
        entity.setTempCriticalHigh(newConfig.getTemperature().getCriticalHigh());
        entity.setTempCriticalLow(newConfig.getTemperature().getCriticalLow());
        entity.setTempWarningHigh(newConfig.getTemperature().getWarningHigh());
        entity.setTempWarningLow(newConfig.getTemperature().getWarningLow());
        
        entity.setHumidityWarningHigh(newConfig.getHumidity().getWarningHigh());
        entity.setHumidityWarningLow(newConfig.getHumidity().getWarningLow());
        
        entity.setNoiseWarning(newConfig.getNoise().getWarning());
        
        alertConfigurationDao.save(entity);
        
        // Update active bean
        updateBeanFromEntity(entity);
    }

    private void updateBeanFromEntity(AlertConfigEntity entity) {
        alertThresholdConfig.setDataMaxAgeMinutes(entity.getDataMaxAgeMinutes());
        
        alertThresholdConfig.getCo2().setCritical(entity.getCo2Critical());
        alertThresholdConfig.getCo2().setWarning(entity.getCo2Warning());
        
        alertThresholdConfig.getTemperature().setCriticalHigh(entity.getTempCriticalHigh());
        alertThresholdConfig.getTemperature().setCriticalLow(entity.getTempCriticalLow());
        alertThresholdConfig.getTemperature().setWarningHigh(entity.getTempWarningHigh());
        alertThresholdConfig.getTemperature().setWarningLow(entity.getTempWarningLow());
        
        alertThresholdConfig.getHumidity().setWarningHigh(entity.getHumidityWarningHigh());
        alertThresholdConfig.getHumidity().setWarningLow(entity.getHumidityWarningLow());
        
        alertThresholdConfig.getNoise().setWarning(entity.getNoiseWarning());
    }
}
