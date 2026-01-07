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
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
public class DashboardServiceImpl implements DashboardService {

    private final SensorDao sensorDao;
    private final SensorDataDao sensorDataDao;
    private final AlertService alertService;

    @Autowired
    public DashboardServiceImpl(SensorDao sensorDao, SensorDataDao sensorDataDao, AlertService alertService) {
        this.sensorDao = sensorDao;
        this.sensorDataDao = sensorDataDao;
        this.alertService = alertService;
    }

    /**
     * Map user-friendly building names to internal database building names.
     * @param building The user-friendly building name (e.g., "levallois", "chateaudun", "lille")
     * @return The internal database building name (e.g., "Levallois-Building")
     */
    private String mapBuildingName(String building) {
        if (building == null || "all".equalsIgnoreCase(building)) {
            return building;
        }

        return switch (building.toLowerCase()) {
            case "levallois" -> "Levallois-Building";
            case "chateaudun", "châteaudun" -> "Châteaudun-Building";
            case "lille" -> "Lille";
            default -> building; // Return as-is if no mapping found
        };
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
        return alertService.getCurrentAlerts();
    }

    private List<LiveSensorData> getLiveSensorData(String building, String floor, String sensorType) {
        List<LiveSensorData> liveSensorData = new ArrayList<>();

        // Get all sensors matching the filters
        List<Sensor> filteredSensors = sensorDao.findAllByDeviceType(sensorType);

        // Apply building filter if provided
        if (building != null && !building.equals("all")) {
            String mappedBuilding = mapBuildingName(building);
            filteredSensors = filteredSensors.stream()
                .filter(sensor -> mappedBuilding.equalsIgnoreCase(sensor.getBuildingName()))
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

        // Get all sensors matching the filters
        List<Sensor> filteredSensors = sensorDao.findAllByDeviceType(sensorType);

        int totalSensors = filteredSensors.size();

        // Calculate occupancy for this date
        var selected = calculateOccupancyStats(filteredSensors);
        double occupancyRate = 0;
        for (var entry : selected.entrySet()) {
            occupancyRate += entry.getValue();
        }
        occupancyRate = occupancyRate / selected.size();

        int activeSensorCount = (int) (totalSensors * (0.9 + Math.random() * 0.1)); // 90-100% active

        dataPoints.add(new DataPoint(
            endDate.format(formatter),
            occupancyRate,
            activeSensorCount,
            123 // TODO: calculate average occupancy rate
        ));

        // Calculate global statistics
        double avgOccupancy = dataPoints.stream()
            .mapToDouble(DataPoint::getOccupancyRate)
            .average()
            .orElse(0.0);

        int activeSensors = (int) (totalSensors * 0.95); // Assume 95% sensors are active

        return new HistoricalData(avgOccupancy, totalSensors, activeSensors, dataPoints);
    }

    @Override
    public List<Desk> getDesks(String building, String floor, Optional<String> deskId) {

        List<Sensor> deskSensors = sensorDao.findAllByDeviceTypes(List.of("DESK", "OCCUP"));

        // building filter (si fourni)
        if (building != null && !"all".equalsIgnoreCase(building) && !building.isBlank()) {
            String mappedBuilding = mapBuildingName(building);
            deskSensors = deskSensors.stream()
                    .filter(s -> mappedBuilding.equalsIgnoreCase(s.getBuildingName()))
                    .collect(Collectors.toList());
        }

        // floor filter (si fourni)
        if (floor != null && !"all".equalsIgnoreCase(floor) && !floor.isBlank()) {
            deskSensors = deskSensors.stream()
                    .filter(s -> floor.equalsIgnoreCase(String.valueOf(s.getFloor())))
                    .collect(Collectors.toList());
        }

        // deskId filter (si fourni)
        if (deskId != null && deskId.isPresent() && !deskId.get().isBlank()) {
            String target = deskId.get();
            deskSensors = deskSensors.stream()
                    .filter(s -> target.equalsIgnoreCase(s.getIdSensor()))
                    .collect(Collectors.toList());
        }

        // mapping -> Desk status
        return deskSensors.stream()
                .map(sensor -> {
                    Optional<SensorData> latest = sensorDataDao.findLatestBySensorAndType(
                            sensor.getIdSensor(), PayloadValueType.OCCUPANCY);

                    String status = latest.map(data -> {
                        String valueStr = data.getValueAsString();
                        if (valueStr == null) return "free";

                        if ("occupied".equalsIgnoreCase(valueStr) || "used".equalsIgnoreCase(valueStr)) return "used";

                        try {
                            double num = Double.parseDouble(valueStr);
                            return num > 0 ? "used" : "free";
                        } catch (NumberFormatException e) {
                            return "free";
                        }
                    }).orElse("invalid");

                    return new Desk(sensor.getIdSensor(), status);
                })
                .collect(Collectors.toList());
    }

    private Map<String, Long> calculateOccupancyStats(List<Sensor> sensors) {
        return sensors.stream()
                .map(sensor -> {
                    Optional<SensorData> latest = sensorDataDao.findLatestBySensorAndType(
                            sensor.getIdSensor(),
                            PayloadValueType.OCCUPANCY
                    );

                    return latest.map(data -> {
                        if (data.getReceivedAt() == null ||
                                data.getReceivedAt().isBefore(LocalDateTime.now().minusHours(1))) {
                            return "invalid";
                        }

                        String valueStr = data.getValueAsString();
                        if (valueStr == null) return "free";

                        if ("occupied".equalsIgnoreCase(valueStr) || "used".equalsIgnoreCase(valueStr)) return "used";
                        if ("free".equalsIgnoreCase(valueStr)) return "free";

                        try {
                            return Double.parseDouble(valueStr) > 0 ? "used" : "free";
                        } catch (NumberFormatException e) {
                            return "free";
                        }
                    }).orElse("invalid");
                })
                .collect(Collectors.groupingBy(s -> s, Collectors.counting()));
    }

    @Override
    public List<SensorInfo> getSensorsList(String building, String floor, String sensorType) {
        log.info("Fetching sensors list: building={}, floor={}, sensorType={}", building, floor, sensorType);

        // Set default sensor type
        if (sensorType == null) sensorType = "DESK";

        // Get all sensors by type
        List<Sensor> sensors = sensorDao.findAllByDeviceType(sensorType);

        // Apply building filter
        if (building != null && !"all".equalsIgnoreCase(building)) {
            String mappedBuilding = mapBuildingName(building);
            sensors = sensors.stream()
                    .filter(s -> mappedBuilding.equalsIgnoreCase(s.getBuildingName()))
                    .collect(Collectors.toList());
        }

        // Apply floor filter
        if (floor != null && !"all".equalsIgnoreCase(floor)) {
            sensors = sensors.stream()
                    .filter(s -> floor.equals(String.valueOf(s.getFloor())))
                    .collect(Collectors.toList());
        }

        // Convert to SensorInfo DTOs
        return sensors.stream()
                .map(s -> new SensorInfo(
                        s.getIdSensor(),
                        s.getDeviceType(),
                        s.getLocation(),
                        s.getBuildingName(),
                        s.getFloor(),
                        true // Assume all returned sensors are active
                ))
                .collect(Collectors.toList());
    }

    @Override
    public List<OccupationHistoryEntry> getOccupationHistory(List<String> sensorIds, int days) {
        log.info("Fetching occupation history for {} sensors, last {} days",
                 sensorIds != null ? sensorIds.size() : 0, days);

        // If no sensors specified, return empty list
        if (sensorIds == null || sensorIds.isEmpty()) {
            return new ArrayList<>();
        }

        // Calculate date range
        LocalDateTime endDate = LocalDateTime.now().truncatedTo(ChronoUnit.DAYS);
        LocalDateTime startDate = endDate.minusDays(days);

        List<OccupationHistoryEntry> history = new ArrayList<>();

        // For each day, calculate occupation rate
        LocalDateTime currentDate = startDate;
        while (!currentDate.isAfter(endDate)) {
            LocalDateTime dayStart = currentDate;
            LocalDateTime dayEnd = currentDate.plusDays(1);

            // Query daily statistics for all sensors
            Map<String, SensorDataDao.HourlyStatistics> dailyStats =
                    sensorDataDao.getDailyStatisticsBatch(
                            sensorIds,
                            PayloadValueType.OCCUPANCY,
                            dayStart,
                            dayEnd);

            if (!dailyStats.isEmpty()) {
                // Calculate occupation rate
                double totalAvg = dailyStats.values().stream()
                        .mapToDouble(SensorDataDao.HourlyStatistics::getAverage)
                        .average()
                        .orElse(0.0);

                int totalReadings = dailyStats.values().stream()
                        .mapToInt(SensorDataDao.HourlyStatistics::getDataPointCount)
                        .sum();

                // Estimate occupied readings (assuming value > 0 means occupied)
                int occupiedReadings = (int) (totalAvg * totalReadings);

                history.add(OccupationHistoryEntry.builder()
                        .date(currentDate.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")))
                        .occupancyRate(totalAvg * 100) // Convert to percentage
                        .totalReadings(totalReadings)
                        .occupiedReadings(occupiedReadings)
                        .build());
            }

            currentDate = currentDate.plusDays(1);
        }

        // Reverse to show most recent first
        java.util.Collections.reverse(history);

        return history;
    }

    @Override
    public HistogramResponse getHistogramData(HistogramRequest request) {
        log.info("Generating histogram data: {}", request);

        // Set defaults
        if (request.getSensorType() == null) request.setSensorType("DESK");
        if (request.getMetricType() == null) request.setMetricType(com.amaris.sensorprocessor.entity.PayloadValueType.OCCUPANCY);
        if (request.getTimeRange() == null) request.setTimeRange(HistogramRequest.TimeRangePreset.LAST_7_DAYS);
        if (request.getGranularity() == null) request.setGranularity(HistogramRequest.Granularity.DAILY);
        if (request.getTimeSlot() == null) request.setTimeSlot(HistogramRequest.TimeSlot.ALL);

        // Auto-switch to hourly granularity for TODAY time range
        if (request.getTimeRange() == HistogramRequest.TimeRangePreset.TODAY) {
            request.setGranularity(HistogramRequest.Granularity.HOURLY);
            log.info("Auto-switched to HOURLY granularity for TODAY time range");
        }

        // Get filtered sensors - if sensorId is specified, use only that sensor
        List<com.amaris.sensorprocessor.entity.Sensor> sensors;
        if (request.getSensorId() != null && !request.getSensorId().isEmpty()) {
            // Single sensor query
            Optional<Sensor> sensorOpt = sensorDao.findByIdOfSensor(request.getSensorId());
            sensors = sensorOpt.map(List::of).orElse(new ArrayList<>());
            log.info("Single sensor query for: {}", request.getSensorId());
        } else {
            // Multiple sensors query
            sensors = sensorDao.findAllByDeviceType(request.getSensorType());
        }

        // Apply building filter
        if (request.getBuilding() != null && !"all".equalsIgnoreCase(request.getBuilding())) {
            String mappedBuilding = mapBuildingName(request.getBuilding());
            sensors = sensors.stream()
                    .filter(s -> mappedBuilding.equalsIgnoreCase(s.getBuildingName()))
                    .collect(Collectors.toList());
        }

        // Apply floor filter
        if (request.getFloor() != null && !"all".equalsIgnoreCase(request.getFloor())) {
            sensors = sensors.stream()
                    .filter(s -> request.getFloor().equals(String.valueOf(s.getFloor())))
                    .collect(Collectors.toList());
        }

        if (sensors.isEmpty()) {
            return HistogramResponse.builder()
                    .metricType(request.getMetricType())
                    .granularity(request.getGranularity().name())
                    .timeRange(request.getTimeRange().name())
                    .aggregationType(HistogramResponse.AggregationType.AVERAGE)
                    .dataPoints(new ArrayList<>())
                    .summary(HistogramSummary.builder()
                            .totalSensors(0)
                            .activeSensors(0)
                            .minValue(0.0)
                            .maxValue(0.0)
                            .avgValue(0.0)
                            .build())
                    .build();
        }

        // Calculate date range
        // For daily granularity, we want to include complete days, so end at the end of today
        LocalDateTime end = LocalDateTime.now().truncatedTo(ChronoUnit.DAYS).plusDays(1).minusSeconds(1);
        LocalDateTime start;
        switch (request.getTimeRange()) {
            case TODAY:
                start = LocalDateTime.now().truncatedTo(ChronoUnit.DAYS); // Start of today
                break;
            case LAST_7_DAYS:
                start = end.minusDays(6).truncatedTo(ChronoUnit.DAYS); // 7 days including today
                break;
            case LAST_30_DAYS:
                start = end.minusDays(29).truncatedTo(ChronoUnit.DAYS); // 30 days including today
                break;
            case THIS_MONTH:
                start = end.withDayOfMonth(1).truncatedTo(ChronoUnit.DAYS);
                break;
            case LAST_MONTH:
                start = end.minusMonths(1).withDayOfMonth(1).truncatedTo(ChronoUnit.DAYS);
                end = end.withDayOfMonth(1).minusDays(1).truncatedTo(ChronoUnit.DAYS).plusDays(1).minusSeconds(1);
                break;
            case CUSTOM:
                if (request.getCustomStartDate() != null && request.getCustomEndDate() != null) {
                    start = LocalDateTime.ofInstant(request.getCustomStartDate().toInstant(),
                            java.time.ZoneId.systemDefault()).truncatedTo(ChronoUnit.DAYS);
                    end = LocalDateTime.ofInstant(request.getCustomEndDate().toInstant(),
                            java.time.ZoneId.systemDefault()).truncatedTo(ChronoUnit.DAYS).plusDays(1).minusSeconds(1);
                } else {
                    start = end.minusDays(6).truncatedTo(ChronoUnit.DAYS);
                }
                break;
            default:
                start = end.minusDays(6).truncatedTo(ChronoUnit.DAYS);
        }

        log.info("Date range: {} to {} (expecting {} days)", start, end,
                ChronoUnit.DAYS.between(start.truncatedTo(ChronoUnit.DAYS), end.truncatedTo(ChronoUnit.DAYS)));

        // Get sensor IDs
        List<String> sensorIds = sensors.stream()
                .map(com.amaris.sensorprocessor.entity.Sensor::getIdSensor)
                .collect(Collectors.toList());

        // Choose between hourly and daily granularity
        Map<String, List<com.amaris.sensorprocessor.repository.SensorDataDao.HourlyStatistics>> dataMap = new HashMap<>();

        if (request.getGranularity() == HistogramRequest.Granularity.HOURLY) {
            // Hourly granularity - generate hour buckets
            log.info("Computing histogram using HOURLY granularity for {} sensors", sensors.size());

            List<LocalDateTime> hourBuckets = new ArrayList<>();
            LocalDateTime currentHour = start.truncatedTo(ChronoUnit.HOURS);
            LocalDateTime endHour = end.truncatedTo(ChronoUnit.HOURS);

            log.info("Generating hour buckets from {} to {}", currentHour, endHour);

            while (!currentHour.isAfter(endHour)) {
                hourBuckets.add(currentHour);
                currentHour = currentHour.plusHours(1);
            }

            log.info("Generated {} hour buckets. Querying with batch queries (1 query per hour for all {} sensors)",
                    hourBuckets.size(), sensors.size());

            // For each hour bucket, query all sensors at once
            for (LocalDateTime hourStart : hourBuckets) {
                LocalDateTime hourEnd = hourStart.plusHours(1);
                String hourKey = hourStart.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:00"));

                log.debug("Querying hour: {} (from {} to {})", hourKey, hourStart, hourEnd);

                // Batch query for all sensors in this hour
                Map<String, com.amaris.sensorprocessor.repository.SensorDataDao.HourlyStatistics> statsMap =
                        sensorDataDao.getHourlyStatisticsBatch(
                                sensorIds,
                                request.getMetricType(),
                                hourStart,
                                hourEnd);

                log.debug("Hour {} returned {} sensors with data", hourKey, statsMap.size());

                if (!statsMap.isEmpty()) {
                    dataMap.put(hourKey, new ArrayList<>(statsMap.values()));
                }
            }

            log.info("Found data for {} hours out of {} total hours",
                    dataMap.size(), hourBuckets.size());

        } else {
            // Daily granularity - generate day buckets
            log.info("Computing histogram using DAILY granularity for {} sensors", sensors.size());

            List<LocalDateTime> dayBuckets = new ArrayList<>();
            LocalDateTime currentDay = start.truncatedTo(ChronoUnit.DAYS);
            LocalDateTime endDay = end.truncatedTo(ChronoUnit.DAYS);

            log.info("Generating day buckets from {} to {}", currentDay, endDay);

            while (!currentDay.isAfter(endDay)) {
                dayBuckets.add(currentDay);
                log.debug("Added day bucket: {}", currentDay);
                currentDay = currentDay.plusDays(1);
            }

            log.info("Generated {} day buckets. Querying with batch queries (1 query per day for all {} sensors)",
                    dayBuckets.size(), sensors.size());

            // For each day bucket, query all sensors at once using batch method
            for (LocalDateTime dayStart : dayBuckets) {
                LocalDateTime dayEnd = dayStart.plusDays(1);
                String dayKey = dayStart.format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));

                log.debug("Querying day: {} (from {} to {})", dayKey, dayStart, dayEnd);

                // Batch query for all sensors in this day
                Map<String, com.amaris.sensorprocessor.repository.SensorDataDao.HourlyStatistics> statsMap =
                        sensorDataDao.getDailyStatisticsBatch(
                                sensorIds,
                                request.getMetricType(),
                                dayStart,
                                dayEnd);

                log.debug("Day {} returned {} sensors with data", dayKey, statsMap.size());

                if (!statsMap.isEmpty()) {
                    dataMap.put(dayKey, new ArrayList<>(statsMap.values()));
                }
            }

            log.info("Found data for {} days out of {} total days",
                    dataMap.size(), dayBuckets.size());
        }

        if (dataMap.isEmpty()) {
            log.warn("No data found! Checking: sensors={}, metricType={}, dateRange=[{} to {}]",
                    sensors.size(), request.getMetricType(), start, end);
        }

        // Convert data to histogram data points
        List<HistogramDataPoint> dataPoints = new ArrayList<>();

        for (Map.Entry<String, List<com.amaris.sensorprocessor.repository.SensorDataDao.HourlyStatistics>> entry : dataMap.entrySet()) {
            String timeKey = entry.getKey();
            List<com.amaris.sensorprocessor.repository.SensorDataDao.HourlyStatistics> stats = entry.getValue();

            // Aggregate across all sensors for this time period
            double avgValue = stats.stream()
                    .mapToDouble(com.amaris.sensorprocessor.repository.SensorDataDao.HourlyStatistics::getAverage)
                    .average()
                    .orElse(0.0);

            int sensorCount = stats.size();
            int totalDataPoints = stats.stream()
                    .mapToInt(com.amaris.sensorprocessor.repository.SensorDataDao.HourlyStatistics::getDataPointCount)
                    .sum();

            dataPoints.add(HistogramDataPoint.builder()
                    .timestamp(timeKey)
                    .value(avgValue)
                    .sensorCount(sensorCount)
                    .dataPointCount(totalDataPoints)
                    .build());
        }

        // Sort by timestamp
        dataPoints.sort(Comparator.comparing(HistogramDataPoint::getTimestamp));

        // Calculate summary
        HistogramSummary summary = HistogramSummary.builder()
                .totalSensors(sensors.size())
                .activeSensors((int) dataPoints.stream()
                        .mapToInt(dp -> dp.getSensorCount() != null ? dp.getSensorCount() : 0)
                        .max()
                        .orElse(0))
                .minValue(dataPoints.stream()
                        .mapToDouble(dp -> dp.getValue() != null ? dp.getValue() : 0.0)
                        .min()
                        .orElse(0.0))
                .maxValue(dataPoints.stream()
                        .mapToDouble(dp -> dp.getValue() != null ? dp.getValue() : 0.0)
                        .max()
                        .orElse(0.0))
                .avgValue(dataPoints.stream()
                        .mapToDouble(dp -> dp.getValue() != null ? dp.getValue() : 0.0)
                        .average()
                        .orElse(0.0))
                .period(HistogramSummary.TimePeriod.builder()
                        .start(start)
                        .end(end)
                        .build())
                .build();

        return HistogramResponse.builder()
                .metricType(request.getMetricType())
                .granularity(request.getGranularity().name())
                .timeRange(request.getTimeRange().name())
                .aggregationType(HistogramResponse.AggregationType.AVERAGE)
                .dataPoints(dataPoints)
                .summary(summary)
                .build();
    }
}
