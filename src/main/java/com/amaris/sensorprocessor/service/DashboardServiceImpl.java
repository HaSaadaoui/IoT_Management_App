package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.amaris.sensorprocessor.entity.Sensor;
import com.amaris.sensorprocessor.entity.SensorData;
import com.amaris.sensorprocessor.model.dashboard.*;

import com.amaris.sensorprocessor.repository.SensorDao;
import com.amaris.sensorprocessor.repository.SensorDataDao;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
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
    public DashboardData getDashboardData(String year, String month, String building, String floor, String sensorType, String timeSlot) {
        log.info("Fetching dashboard data with filters: year={}, month={}, building={}, floor={}, sensorType={}, timeSlot={}",
                year, month, building, floor, sensorType, timeSlot);

        // Set defaults if parameters are null
        sensorType = sensorType != null ? sensorType : "DESK";

        // Get alerts
        List<Alert> alerts = getAlerts();

        // Get live sensor data with filters
        List<LiveSensorData> liveSensorData = getLiveSensorData(building, floor, sensorType);

        // Get historical data with filters
        HistoricalData historicalData = getHistoricalData(year, month, building, floor, sensorType, timeSlot);

        return new DashboardData(alerts, liveSensorData, historicalData);
    }

    private List<Alert> getAlerts() {
        return List.of(
            new Alert("critical", "⚠️", "Critical CO2 Level", "Sensor CO2-B2 detected 1200 ppm", "2 minutes ago"),
            new Alert("warning", "🔔", "High Temperature", "Room A-103 temperature at 28°C", "15 minutes ago"),
            new Alert("info", "ℹ️", "Sensor Offline", "DESK-F1-12 not responding", "1 hour ago"),
            new Alert("success", "✅", "System Restored", "Gateway rpi-mantu back online", "2 hours ago")
        );
    }

    private List<LiveSensorData> getLiveSensorData(String building, String floor, String sensorType) {
        List<LiveSensorData> liveSensorData = new ArrayList<>();

        // Get all sensors matching the filters
        List<Sensor> filteredSensors = sensorDao.findAllByDeviceType(sensorType);

        // Apply building filter if provided
        if (building != null && !building.equals("all")) {
            filteredSensors = filteredSensors.stream()
                .filter(sensor -> building.equalsIgnoreCase(sensor.getBuildingName()))
                .collect(Collectors.toList());
        }

        // Apply floor filter if provided
        if (floor != null && !floor.equals("all")) {
            filteredSensors = filteredSensors.stream()
                .filter(sensor -> floor.equals(String.valueOf(sensor.getFloor())))
                .collect(Collectors.toList());
        }

        // Group sensors by location
        Map<String, List<Sensor>> sensorsByLocation = filteredSensors.stream()
            .collect(Collectors.groupingBy(sensor ->
                sensor.getLocation() != null ? sensor.getLocation() : "Unknown Location"
            ));

        // Calculate stats for each location
        for (Map.Entry<String, List<Sensor>> entry : sensorsByLocation.entrySet()) {
            String location = entry.getKey();
            List<Sensor> sensorsInLocation = entry.getValue();
            Map<String, Long> stats = calculateOccupancyStats(sensorsInLocation);

            liveSensorData.add(new LiveSensorData(
                location,
                stats.getOrDefault("free", 0L).intValue(),
                stats.getOrDefault("used", 0L).intValue(),
                stats.getOrDefault("invalid", 0L).intValue()
            ));
        }

        // Add total statistics
        Map<String, Long> totalStats = calculateOccupancyStats(filteredSensors);
        liveSensorData.add(new LiveSensorData(
            "Total Live Data",
            totalStats.getOrDefault("free", 0L).intValue(),
            totalStats.getOrDefault("used", 0L).intValue(),
            totalStats.getOrDefault("invalid", 0L).intValue()
        ));

        return liveSensorData;
    }

    private HistoricalData getHistoricalData(String year, String month, String building, String floor, String sensorType, String timeSlot) {
        // Generate historical data for the last 30 days
        List<DataPoint> dataPoints = new ArrayList<>();
        DateTimeFormatter formatter = DateTimeFormatter.ISO_LOCAL_DATE;

        int daysToGenerate = 30;
        LocalDate endDate = LocalDate.now();

        // If year and month are provided, use them
        if (year != null && month != null) {
            try {
                int y = Integer.parseInt(year);
                int m = Integer.parseInt(month);
                endDate = LocalDate.of(y, m, 1).plusMonths(1).minusDays(1);
                daysToGenerate = endDate.getDayOfMonth();
            } catch (Exception e) {
                log.warn("Invalid year/month provided, using current date", e);
            }
        }

        // Get all sensors matching the filters
        List<Sensor> filteredSensors = sensorDao.findAllByDeviceType(sensorType);

        if (building != null && !building.equals("all")) {
            filteredSensors = filteredSensors.stream()
                .filter(sensor -> building.equalsIgnoreCase(sensor.getBuildingName()))
                .collect(Collectors.toList());
        }

        if (floor != null && !floor.equals("all")) {
            filteredSensors = filteredSensors.stream()
                .filter(sensor -> floor.equals(String.valueOf(sensor.getFloor())))
                .collect(Collectors.toList());
        }

        int totalSensors = filteredSensors.size();

        // Generate data points for each day
        for (int i = daysToGenerate - 1; i >= 0; i--) {
            LocalDate date = endDate.minusDays(i);

            // Calculate occupancy for this date
            // In production, this should query actual historical data
            // For now, we'll generate sample data based on sensor count
            double occupancyRate = 20 + Math.random() * 40; // 20-60%
            int activeSensorCount = (int) (totalSensors * (0.9 + Math.random() * 0.1)); // 90-100% active

            dataPoints.add(new DataPoint(
                date.format(formatter),
                occupancyRate,
                activeSensorCount,
                occupancyRate
            ));
        }

        // Calculate global statistics
        double avgOccupancy = dataPoints.stream()
            .mapToDouble(DataPoint::getOccupancyRate)
            .average()
            .orElse(0.0);

        int activeSensors = (int) (totalSensors * 0.95); // Assume 95% sensors are active

        return new HistoricalData(avgOccupancy, totalSensors, activeSensors, dataPoints);
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
