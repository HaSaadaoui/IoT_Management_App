package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.amaris.sensorprocessor.entity.Sensor;
import com.amaris.sensorprocessor.entity.SensorData;
import com.amaris.sensorprocessor.model.dashboard.Alert;
import com.amaris.sensorprocessor.model.dashboard.DashboardData;
import com.amaris.sensorprocessor.model.dashboard.HistoricalData;
import com.amaris.sensorprocessor.model.dashboard.LiveSensorData;

import com.amaris.sensorprocessor.model.dashboard.Desk;
import com.amaris.sensorprocessor.repository.SensorDao;
import com.amaris.sensorprocessor.repository.SensorDataDao;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class DashboardServiceImpl implements DashboardService {

    private final SensorDao sensorDao;
    private final SensorDataDao sensorDataDao;

    @Autowired
    public DashboardServiceImpl(SensorDao sensorDao, SensorDataDao sensorDataDao) {
        this.sensorDao = sensorDao;
        this.sensorDataDao = sensorDataDao;
    }

    @Override
    public DashboardData getDashboardData() {
        List<Alert> alerts = List.of(
            new Alert("critical", "⚠️", "Critical CO2 Level", "Sensor CO2-B2 detected 1200 ppm", "2 minutes ago"),
            new Alert("warning", "🔔", "High Temperature", "Room A-103 temperature at 28°C", "15 minutes ago"),
            new Alert("info", "ℹ️", "Sensor Offline", "DESK-F1-12 not responding", "1 hour ago"),
            new Alert("success", "✅", "System Restored", "Gateway rpi-mantu back online", "2 hours ago")
        );

        List<LiveSensorData> liveSensorData = new ArrayList<>();
        List<String> roomLocations = List.of("Open_05-01", "Open_05-02", "Meeting Room A");

        for (String location : roomLocations) {
            List<Sensor> sensorsInLocation = sensorDao.findAllByLocation(location);
            Map<String, Long> stats = calculateOccupancyStats(sensorsInLocation);
            liveSensorData.add(new LiveSensorData(location, stats.getOrDefault("free", 0L).intValue(), stats.getOrDefault("used", 0L).intValue(), stats.getOrDefault("invalid", 0L).intValue()));
        }

        List<Sensor> allDeskSensors = sensorDao.findAllByDeviceType("DESK");
        Map<String, Long> totalStats = calculateOccupancyStats(allDeskSensors);
        liveSensorData.add(new LiveSensorData("Total Live Data", totalStats.getOrDefault("free", 0L).intValue(), totalStats.getOrDefault("used", 0L).intValue(), totalStats.getOrDefault("invalid", 0L).intValue()));


        HistoricalData historicalData = new HistoricalData(
            32.93,
            List.of(
                Map.of("date", "17/10/2025", "occupancy", "29%"),
                Map.of("date", "16/10/2025", "occupancy", "30%"),
                Map.of("date", "15/10/2025", "occupancy", "37%"),
                Map.of("date", "14/10/2025", "occupancy", "36%"),
                Map.of("date", "13/10/2025", "occupancy", "35%")
            )
        );
        return new DashboardData(alerts, liveSensorData, historicalData);
    }

    @Override
    public List<Desk> getDesksByFloor(String floor, Optional<String> deskId) {
        List<Sensor> deskSensors = sensorDao.findAllByDeviceType("DESK");

        return deskSensors.stream()
                .filter(sensor -> floor.equalsIgnoreCase(String.valueOf(sensor.getFloor())))
                .filter(sensor -> deskId.map(id -> id.equalsIgnoreCase(sensor.getIdSensor())).orElse(true))
                .map(sensor -> {
                    Optional<SensorData> latestOccupancyData = sensorDataDao.findLatestBySensorAndType(sensor.getIdSensor(), PayloadValueType.OCCUPANCY);
                    String status = latestOccupancyData.map(data -> {
                        if (data.getReceivedAt().isBefore(LocalDateTime.now().minusHours(1))) {
                            return "invalid";
                        }
                        return Boolean.TRUE.equals(data.getValueAsBoolean()) ? "used" : "free";
                    }).orElse("invalid");
                    return new Desk(sensor.getIdSensor(), status);
                })
                .collect(Collectors.toList());
    }

    private Map<String, Long> calculateOccupancyStats(List<Sensor> sensors) {
        return sensors.stream()
                .map(sensor -> {
                    Optional<SensorData> latestOccupancyData = sensorDataDao.findLatestBySensorAndType(sensor.getIdSensor(), PayloadValueType.OCCUPANCY);
                    return latestOccupancyData.map(data -> {
                        if (data.getReceivedAt().isBefore(LocalDateTime.now().minusHours(1))) {
                            return "invalid";
                        }
                        return Boolean.TRUE.equals(data.getValueAsBoolean()) ? "used" : "free";
                    }).orElse("invalid");
                })
                .collect(Collectors.groupingBy(status -> status, Collectors.counting()));
    }
}
