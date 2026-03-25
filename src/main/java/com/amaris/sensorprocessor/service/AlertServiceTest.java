package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.amaris.sensorprocessor.entity.SensorData;
import com.amaris.sensorprocessor.model.dashboard.Alert;
import com.amaris.sensorprocessor.repository.SensorDataDao;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
public class AlertServiceTest {

    private final SensorDataDao sensorDataDao;

    @Autowired
    public AlertServiceTest(SensorDataDao sensorDataDao) {
        this.sensorDataDao = sensorDataDao;
    }

    public List<Alert> getTestAlerts() {
        List<Alert> alerts = new ArrayList<>();
        
        // Test with a known sensor reading
        Optional<SensorData> testData = sensorDataDao.findLatestBySensorAndType("TEST-CO2", PayloadValueType.CO2);
        
        if (testData.isPresent()) {
            SensorData data = testData.get();
            try {
                double co2Value = Double.parseDouble(data.getValueAsString());
                if (co2Value > 1000) {
                    alerts.add(new Alert(
                        "warning",
                        "🔔",
                        "Test CO2 Alert",
                        String.format("Test sensor detected %.0f ppm", co2Value),
                        "Just now"
                    ));
                }
            } catch (NumberFormatException e) {
                log.warn("Invalid CO2 value: {}", data.getValueAsString());
            }
        } else {
            // Add a test alert even if no data
            alerts.add(new Alert(
                "info",
                "ℹ️",
                "Test Alert",
                "Test sensor offline",
                "Just now"
            ));
        }
        
        return alerts;
    }

    public String simulateTestData() {
        try {
            // Insert test sensor data that will trigger alerts
            LocalDateTime now = LocalDateTime.now();
            
            // High CO2 data (above threshold of 1000)
            SensorData highCO2 = new SensorData("co2-03-03", now, "1150", PayloadValueType.CO2.toString());
            sensorDataDao.insertSensorData(highCO2);
            
            // High temperature data (above threshold of 27.0)
            SensorData highTemp = new SensorData("co2-03-03", now, "28.5", PayloadValueType.TEMPERATURE.toString());
            sensorDataDao.insertSensorData(highTemp);
            
            // High humidity data (above threshold of 70.0)
            SensorData highHumidity = new SensorData("co2-03-03", now, "75.0", PayloadValueType.HUMIDITY.toString());
            sensorDataDao.insertSensorData(highHumidity);
            
            log.info("Simulated test data inserted: CO2=1150ppm, Temp=28.5°C, Humidity=75%");
            return "Test data simulated successfully. Check dashboard for alerts.";
        } catch (Exception e) {
            log.error("Failed to simulate test data", e);
            return "Failed to simulate test data: " + e.getMessage();
        }
    }
}