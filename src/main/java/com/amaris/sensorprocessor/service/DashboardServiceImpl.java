package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.BuildingMapping;
import com.amaris.sensorprocessor.entity.DeviceType;
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
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class DashboardServiceImpl implements DashboardService {

    private final SensorDao sensorDao;
    private final SensorDataDao sensorDataDao;
    private final AlertService alertService;
    private final DeviceTypeService deviceTypeService; // ✅ AJOUT

    @Autowired
    public DashboardServiceImpl(SensorDao sensorDao, SensorDataDao sensorDataDao,
                                AlertService alertService, DeviceTypeService deviceTypeService) { // ✅ AJOUT
        this.sensorDao = sensorDao;
        this.sensorDataDao = sensorDataDao;
        this.alertService = alertService;
        this.deviceTypeService = deviceTypeService; // ✅ AJOUT
    }

    private String mapBuildingName(String building) {
        if (building == null || "all".equalsIgnoreCase(building)) {
            return building;
        }
        return switch (building.toLowerCase()) {
            case "levallois" -> "Levallois-Building";
            case "chateaudun", "châteaudun" -> "Châteaudun-Building";
            case "lille" -> "Lille";
            default -> building;
        };
    }

    // ✅ Helper : charge tous les labels en une seule requête
    private Map<Integer, String> loadDeviceTypeMap() {
        return deviceTypeService.findAll().stream()
                .collect(Collectors.toMap(DeviceType::getIdDeviceType, DeviceType::getLabel));
    }

    @Override
    public DashboardData getDashboardData(String year, String month, String building,
                                          String floor, String sensorType, String timeSlot) {
        log.info("Fetching dashboard data: year={}, month={}, building={}, floor={}, sensorType={}, timeSlot={}",
                year, month, building, floor, sensorType, timeSlot);

        sensorType = sensorType != null ? sensorType : "DESK";
        String buildingName = BuildingMapping.toDbName(building);

        alertService.startMonitoringForBuilding(building, sensorType, buildingName);
        List<Alert> alerts = alertService.getCurrentAlertsWithWait(buildingName, 500);
        List<LiveSensorData> liveSensorData = getLiveSensorData(building, floor, sensorType);
        HistoricalData historicalData = getHistoricalData(year, month, building, floor, sensorType, timeSlot);

        return new DashboardData(alerts, liveSensorData, historicalData);
    }

    private List<Alert> getAlerts(String building) {
        return alertService.getCurrentAlerts(building);
    }

    private List<LiveSensorData> getLiveSensorData(String building, String floor, String sensorType) {
        List<LiveSensorData> liveSensorData = new ArrayList<>();
        List<Sensor> filteredSensors = sensorDao.findAllByDeviceType(sensorType);

        if (building != null && !building.equals("all")) {
            String mappedBuilding = mapBuildingName(building);
            filteredSensors = filteredSensors.stream()
                    .filter(sensor -> mappedBuilding.equalsIgnoreCase(sensor.getBuildingName()))
                    .collect(Collectors.toList());
        }

        if (floor != null && !floor.equals("all")) {
            filteredSensors = filteredSensors.stream()
                    .filter(sensor -> floor.equals(String.valueOf(sensor.getFloor())))
                    .collect(Collectors.toList());
        }

        Map<String, List<Sensor>> sensorsByLocation = filteredSensors.stream()
                .collect(Collectors.groupingBy(sensor ->
                        sensor.getLocation() != null ? sensor.getLocation() : "Unknown Location"
                ));

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

        Map<String, Long> totalStats = calculateOccupancyStats(filteredSensors);
        liveSensorData.add(new LiveSensorData(
                "Total Live Data",
                totalStats.getOrDefault("free", 0L).intValue(),
                totalStats.getOrDefault("used", 0L).intValue(),
                totalStats.getOrDefault("invalid", 0L).intValue()
        ));

        return liveSensorData;
    }

    private HistoricalData getHistoricalData(String year, String month, String building,
                                             String floor, String sensorType, String timeSlot) {
        List<DataPoint> dataPoints = new ArrayList<>();
        DateTimeFormatter formatter = DateTimeFormatter.ISO_LOCAL_DATE;

        LocalDate endDate = LocalDate.now();
        List<Sensor> filteredSensors = sensorDao.findAllByDeviceType(sensorType);

        int totalSensors = filteredSensors.size();
        var selected = calculateOccupancyStats(filteredSensors);
        double occupancyRate = 0;
        for (var entry : selected.entrySet()) {
            occupancyRate += entry.getValue();
        }
        occupancyRate = occupancyRate / selected.size();

        int activeSensorCount = (int) (totalSensors * (0.9 + Math.random() * 0.1));

        dataPoints.add(new DataPoint(endDate.format(formatter), occupancyRate, activeSensorCount, 123));

        double avgOccupancy = dataPoints.stream()
                .mapToDouble(DataPoint::getOccupancyRate)
                .average()
                .orElse(0.0);

        int activeSensors = (int) (totalSensors * 0.95);
        return new HistoricalData(avgOccupancy, totalSensors, activeSensors, dataPoints);
    }

    @Override
    public List<Desk> getDesks(String building, String floor, Optional<String> deskId) {
        List<Sensor> deskSensors = sensorDao.findAllByDeviceTypes(List.of("DESK", "OCCUP", "COUNT"));

        if (building != null && !"all".equalsIgnoreCase(building) && !building.isBlank()) {
            String mappedBuilding = mapBuildingName(building);
            deskSensors = deskSensors.stream()
                    .filter(s -> mappedBuilding.equalsIgnoreCase(s.getBuildingName()))
                    .collect(Collectors.toList());
        }

        if (floor != null && !"all".equalsIgnoreCase(floor) && !floor.isBlank()) {
            deskSensors = deskSensors.stream()
                    .filter(s -> floor.equalsIgnoreCase(String.valueOf(s.getFloor())))
                    .collect(Collectors.toList());
        }

        if (deskId != null && deskId.isPresent() && !deskId.get().isBlank()) {
            String target = deskId.get();
            deskSensors = deskSensors.stream()
                    .filter(s -> target.equalsIgnoreCase(s.getIdSensor()))
                    .collect(Collectors.toList());
        }

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
                            sensor.getIdSensor(), PayloadValueType.OCCUPANCY);

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

        if (sensorType == null) sensorType = "DESK";

        List<Sensor> sensors = sensorDao.findAllByDeviceType(sensorType);

        if (building != null && !"all".equalsIgnoreCase(building)) {
            String mappedBuilding = mapBuildingName(building);
            sensors = sensors.stream()
                    .filter(s -> mappedBuilding.equalsIgnoreCase(s.getBuildingName()))
                    .collect(Collectors.toList());
        }

        if (floor != null && !"all".equalsIgnoreCase(floor)) {
            sensors = sensors.stream()
                    .filter(s -> floor.equals(String.valueOf(s.getFloor())))
                    .collect(Collectors.toList());
        }

        // ✅ Charger les labels en une seule requête
        Map<Integer, String> deviceTypeMap = loadDeviceTypeMap();

        return sensors.stream()
                .map(s -> new SensorInfo(
                        s.getIdSensor(),
                        deviceTypeMap.getOrDefault(s.getIdDeviceType(), "UNKNOWN"), // ✅ label via map
                        s.getLocation(),
                        s.getBuildingName(),
                        s.getFloor(),
                        true
                ))
                .collect(Collectors.toList());
    }

    @Override
    public List<OccupationHistoryEntry> getOccupationHistory(List<String> sensorIds, int days) {
        log.info("Fetching occupation history for {} sensors, last {} days",
                sensorIds != null ? sensorIds.size() : 0, days);

        if (sensorIds == null || sensorIds.isEmpty()) return new ArrayList<>();

        LocalDateTime endDate = LocalDateTime.now().truncatedTo(ChronoUnit.DAYS);
        LocalDateTime startDate = endDate.minusDays(days);
        List<OccupationHistoryEntry> history = new ArrayList<>();
        LocalDateTime currentDate = startDate;

        while (!currentDate.isAfter(endDate)) {
            LocalDateTime dayStart = currentDate;
            LocalDateTime dayEnd = currentDate.plusDays(1);

            Map<String, SensorDataDao.HourlyStatistics> dailyStats =
                    sensorDataDao.getDailyStatisticsBatch(sensorIds, PayloadValueType.OCCUPANCY, dayStart, dayEnd);

            if (!dailyStats.isEmpty()) {
                double totalAvg = dailyStats.values().stream()
                        .mapToDouble(SensorDataDao.HourlyStatistics::getAverage)
                        .average()
                        .orElse(0.0);

                int totalReadings = dailyStats.values().stream()
                        .mapToInt(SensorDataDao.HourlyStatistics::getDataPointCount)
                        .sum();

                int occupiedReadings = (int) (totalAvg * totalReadings);

                history.add(OccupationHistoryEntry.builder()
                        .date(currentDate.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")))
                        .occupancyRate(totalAvg * 100)
                        .totalReadings(totalReadings)
                        .occupiedReadings(occupiedReadings)
                        .build());
            }
            currentDate = currentDate.plusDays(1);
        }

        java.util.Collections.reverse(history);
        return history;
    }

    private boolean isTotalMetric(PayloadValueType t) {
        return t == PayloadValueType.POWER_TOTAL || t == PayloadValueType.ENERGY_TOTAL;
    }

    private List<PayloadValueType> totalComponents(PayloadValueType t) {
        if (t == PayloadValueType.POWER_TOTAL) {
            return List.of(
                    PayloadValueType.POWER_CHANNEL_0, PayloadValueType.POWER_CHANNEL_1,
                    PayloadValueType.POWER_CHANNEL_2, PayloadValueType.POWER_CHANNEL_3,
                    PayloadValueType.POWER_CHANNEL_4, PayloadValueType.POWER_CHANNEL_5,
                    PayloadValueType.POWER_CHANNEL_6, PayloadValueType.POWER_CHANNEL_7,
                    PayloadValueType.POWER_CHANNEL_8, PayloadValueType.POWER_CHANNEL_9,
                    PayloadValueType.POWER_CHANNEL_10, PayloadValueType.POWER_CHANNEL_11
            );
        }
        if (t == PayloadValueType.ENERGY_TOTAL) {
            return List.of(
                    PayloadValueType.ENERGY_CHANNEL_0, PayloadValueType.ENERGY_CHANNEL_1,
                    PayloadValueType.ENERGY_CHANNEL_2, PayloadValueType.ENERGY_CHANNEL_3,
                    PayloadValueType.ENERGY_CHANNEL_4, PayloadValueType.ENERGY_CHANNEL_5,
                    PayloadValueType.ENERGY_CHANNEL_6, PayloadValueType.ENERGY_CHANNEL_7,
                    PayloadValueType.ENERGY_CHANNEL_8, PayloadValueType.ENERGY_CHANNEL_9,
                    PayloadValueType.ENERGY_CHANNEL_10, PayloadValueType.ENERGY_CHANNEL_11
            );
        }
        return List.of(t);
    }

    @Override
    public HistogramResponse getHistogramData(HistogramRequest request) {
        log.info("Generating histogram data: {}", request);

        if (request.getSensorType() == null) request.setSensorType("DESK");
        if (request.getMetricType() == null) request.setMetricType(PayloadValueType.OCCUPANCY);
        if (request.getTimeRange() == null) request.setTimeRange(HistogramRequest.TimeRangePreset.LAST_7_DAYS);
        if (request.getGranularity() == null) request.setGranularity(HistogramRequest.Granularity.DAILY);
        if (request.getTimeSlot() == null) request.setTimeSlot(HistogramRequest.TimeSlot.ALL);

        if (request.getTimeRange() == HistogramRequest.TimeRangePreset.TODAY) {
            request.setGranularity(HistogramRequest.Granularity.HOURLY);
        }

        final boolean totalMode = isTotalMetric(request.getMetricType());
        final List<PayloadValueType> metricParts = totalMode
                ? totalComponents(request.getMetricType())
                : List.of(request.getMetricType());

        // ✅ Charger la map une seule fois pour toute la méthode
        Map<Integer, String> deviceTypeMap = loadDeviceTypeMap();

        List<Sensor> sensors;
        if (hasText(request.getSensorId())) {
            Optional<Sensor> sensorOpt = sensorDao.findByIdOfSensor(request.getSensorId());
            sensors = sensorOpt.map(List::of).orElseGet(ArrayList::new);
        } else {
            if (isAllSensorType(request.getSensorType())) {
                sensors = sensorDao.findAllSensors();
            } else {
                sensors = sensorDao.findAllByDeviceType(request.getSensorType());
            }
        }

        if (hasText(request.getBuilding()) && !"all".equalsIgnoreCase(request.getBuilding())) {
            String mappedBuilding = mapBuildingName(request.getBuilding());
            sensors = sensors.stream()
                    .filter(s -> mappedBuilding.equalsIgnoreCase(s.getBuildingName()))
                    .collect(Collectors.toList());
        }

        if (hasText(request.getFloor()) && !"all".equalsIgnoreCase(request.getFloor())) {
            sensors = sensors.stream()
                    .filter(s -> request.getFloor().equals(String.valueOf(s.getFloor())))
                    .collect(Collectors.toList());
        }

        // ✅ exclude sensorType via la map
        if (hasText(request.getExcludeSensorType())) {
            String ex = request.getExcludeSensorType().trim();
            sensors = sensors.stream()
                    .filter(s -> {
                        String label = deviceTypeMap.getOrDefault(s.getIdDeviceType(), "");
                        return !ex.equalsIgnoreCase(label);
                    })
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
                            .totalSensors(0).activeSensors(0)
                            .minValue(0.0).maxValue(0.0).avgValue(0.0)
                            .build())
                    .build();
        }

        LocalDateTime end = LocalDateTime.now().truncatedTo(ChronoUnit.DAYS).plusDays(1).minusSeconds(1);
        LocalDateTime start;

        switch (request.getTimeRange()) {
            case TODAY        -> start = LocalDateTime.now().truncatedTo(ChronoUnit.DAYS);
            case LAST_7_DAYS  -> start = end.minusDays(6).truncatedTo(ChronoUnit.DAYS);
            case LAST_30_DAYS -> start = end.minusDays(29).truncatedTo(ChronoUnit.DAYS);
            case THIS_MONTH   -> start = end.withDayOfMonth(1).truncatedTo(ChronoUnit.DAYS);
            case LAST_MONTH   -> {
                start = end.minusMonths(1).withDayOfMonth(1).truncatedTo(ChronoUnit.DAYS);
                end   = end.withDayOfMonth(1).minusDays(1).truncatedTo(ChronoUnit.DAYS).plusDays(1).minusSeconds(1);
            }
            case CUSTOM -> {
                if (request.getCustomStartDate() != null && request.getCustomEndDate() != null) {
                    start = LocalDateTime.ofInstant(request.getCustomStartDate().toInstant(),
                            java.time.ZoneId.systemDefault()).truncatedTo(ChronoUnit.DAYS);
                    end   = LocalDateTime.ofInstant(request.getCustomEndDate().toInstant(),
                            java.time.ZoneId.systemDefault()).truncatedTo(ChronoUnit.DAYS).plusDays(1).minusSeconds(1);
                } else {
                    start = end.minusDays(6).truncatedTo(ChronoUnit.DAYS);
                }
            }
            default -> start = end.minusDays(6).truncatedTo(ChronoUnit.DAYS);
        }

        log.info("Date range: {} to {}", start, end);

        List<String> candidateIds = sensors.stream().map(Sensor::getIdSensor).collect(Collectors.toList());
        java.util.Set<String> sensorsWithData = new java.util.HashSet<>();

        for (PayloadValueType part : metricParts) {
            Map<String, SensorDataDao.HourlyStatistics> m = (request.getGranularity() == HistogramRequest.Granularity.HOURLY)
                    ? sensorDataDao.getHourlyStatisticsBatch(candidateIds, part, start, end)
                    : sensorDataDao.getDailyStatisticsBatch(candidateIds, part, start, end);
            if (m != null && !m.isEmpty()) sensorsWithData.addAll(m.keySet());
        }

        sensors = sensors.stream()
                .filter(s -> sensorsWithData.contains(s.getIdSensor()))
                .collect(Collectors.toList());

        if (sensors.isEmpty()) {
            return HistogramResponse.builder()
                    .metricType(request.getMetricType())
                    .granularity(request.getGranularity().name())
                    .timeRange(request.getTimeRange().name())
                    .aggregationType(HistogramResponse.AggregationType.AVERAGE)
                    .dataPoints(new ArrayList<>())
                    .summary(HistogramSummary.builder()
                            .totalSensors(0).activeSensors(0)
                            .minValue(0.0).maxValue(0.0).avgValue(0.0)
                            .period(HistogramSummary.TimePeriod.builder().start(start).end(end).build())
                            .build())
                    .build();
        }

        List<String> sensorIds = sensors.stream().map(Sensor::getIdSensor).collect(Collectors.toList());
        Map<String, List<SensorDataDao.HourlyStatistics>> dataMap = new HashMap<>();

        if (request.getGranularity() == HistogramRequest.Granularity.HOURLY) {
            LocalDateTime current = start.truncatedTo(ChronoUnit.HOURS);
            LocalDateTime last = end.truncatedTo(ChronoUnit.HOURS);

            while (!current.isAfter(last)) {
                LocalDateTime bucketStart = current;
                LocalDateTime bucketEnd = current.plusHours(1);
                String key = bucketStart.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:00"));

                if (!totalMode) {
                    Map<String, SensorDataDao.HourlyStatistics> statsMap =
                            sensorDataDao.getHourlyStatisticsBatch(sensorIds, request.getMetricType(), bucketStart, bucketEnd);
                    if (statsMap != null && !statsMap.isEmpty()) dataMap.put(key, new ArrayList<>(statsMap.values()));
                } else {
                    Map<String, Double> sumAbsBySensor = new HashMap<>();
                    Map<String, Integer> maxCountBySensor = new HashMap<>();
                    for (PayloadValueType part : metricParts) {
                        Map<String, SensorDataDao.HourlyStatistics> m =
                                sensorDataDao.getHourlyStatisticsBatch(sensorIds, part, bucketStart, bucketEnd);
                        if (m == null || m.isEmpty()) continue;
                        for (Map.Entry<String, SensorDataDao.HourlyStatistics> e : m.entrySet()) {
                            sumAbsBySensor.merge(e.getKey(), Math.abs(e.getValue().getAverage()), Double::sum);
                            maxCountBySensor.merge(e.getKey(), e.getValue().getDataPointCount(), Math::max);
                        }
                    }
                    if (!sumAbsBySensor.isEmpty()) {
                        List<SensorDataDao.HourlyStatistics> merged = new ArrayList<>();
                        for (Map.Entry<String, Double> e : sumAbsBySensor.entrySet()) {
                            int cnt = maxCountBySensor.getOrDefault(e.getKey(), 0);
                            merged.add(new SensorDataDao.HourlyStatistics(e.getValue(), e.getValue(), e.getValue(), cnt));
                        }
                        dataMap.put(key, merged);
                    }
                }
                current = current.plusHours(1);
            }
        } else {
            LocalDateTime current = start.truncatedTo(ChronoUnit.DAYS);
            LocalDateTime last = end.truncatedTo(ChronoUnit.DAYS);

            while (!current.isAfter(last)) {
                LocalDateTime bucketStart = current;
                LocalDateTime bucketEnd = current.plusDays(1);
                String key = bucketStart.format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));

                if (!totalMode) {
                    Map<String, SensorDataDao.HourlyStatistics> statsMap =
                            sensorDataDao.getDailyStatisticsBatch(sensorIds, request.getMetricType(), bucketStart, bucketEnd);
                    if (statsMap != null && !statsMap.isEmpty()) dataMap.put(key, new ArrayList<>(statsMap.values()));
                } else {
                    Map<String, Double> sumAbsBySensor = new HashMap<>();
                    Map<String, Integer> maxCountBySensor = new HashMap<>();
                    for (PayloadValueType part : metricParts) {
                        Map<String, SensorDataDao.HourlyStatistics> m =
                                sensorDataDao.getDailyStatisticsBatch(sensorIds, part, bucketStart, bucketEnd);
                        if (m == null || m.isEmpty()) continue;
                        for (Map.Entry<String, SensorDataDao.HourlyStatistics> e : m.entrySet()) {
                            sumAbsBySensor.merge(e.getKey(), Math.abs(e.getValue().getAverage()), Double::sum);
                            maxCountBySensor.merge(e.getKey(), e.getValue().getDataPointCount(), Math::max);
                        }
                    }
                    if (!sumAbsBySensor.isEmpty()) {
                        List<SensorDataDao.HourlyStatistics> merged = new ArrayList<>();
                        for (Map.Entry<String, Double> e : sumAbsBySensor.entrySet()) {
                            int cnt = maxCountBySensor.getOrDefault(e.getKey(), 0);
                            merged.add(new SensorDataDao.HourlyStatistics(e.getValue(), e.getValue(), e.getValue(), cnt));
                        }
                        dataMap.put(key, merged);
                    }
                }
                current = current.plusDays(1);
            }
        }

        List<HistogramDataPoint> dataPoints = new ArrayList<>();
        for (Map.Entry<String, List<SensorDataDao.HourlyStatistics>> entry : dataMap.entrySet()) {
            String timeKey = entry.getKey();
            List<SensorDataDao.HourlyStatistics> stats = entry.getValue();
            if (stats == null || stats.isEmpty()) continue;

            double value = stats.stream()
                    .mapToDouble(SensorDataDao.HourlyStatistics::getAverage)
                    .average()
                    .orElse(0.0);

            int sensorCount = stats.size();
            int totalDataPoints = !totalMode
                    ? stats.stream().mapToInt(SensorDataDao.HourlyStatistics::getDataPointCount).sum()
                    : stats.stream().mapToInt(SensorDataDao.HourlyStatistics::getDataPointCount).max().orElse(0);

            dataPoints.add(HistogramDataPoint.builder()
                    .timestamp(timeKey)
                    .value(value)
                    .sensorCount(sensorCount)
                    .dataPointCount(totalDataPoints)
                    .build());
        }

        dataPoints.sort(Comparator.comparing(HistogramDataPoint::getTimestamp));

        double minValue = dataPoints.stream()
                .mapToDouble(dp -> totalMode ? Math.abs(dp.getValue() != null ? dp.getValue() : 0.0) : (dp.getValue() != null ? dp.getValue() : 0.0))
                .min().orElse(0.0);

        double maxValue = dataPoints.stream()
                .mapToDouble(dp -> totalMode ? Math.abs(dp.getValue() != null ? dp.getValue() : 0.0) : (dp.getValue() != null ? dp.getValue() : 0.0))
                .max().orElse(0.0);

        double avgValue = dataPoints.stream()
                .mapToDouble(dp -> totalMode ? Math.abs(dp.getValue() != null ? dp.getValue() : 0.0) : (dp.getValue() != null ? dp.getValue() : 0.0))
                .average().orElse(0.0);

        int activeSensors = (int) dataPoints.stream()
                .mapToInt(dp -> dp.getSensorCount() != null ? dp.getSensorCount() : 0)
                .max().orElse(0);

        HistogramSummary summary = HistogramSummary.builder()
                .totalSensors(sensors.size())
                .activeSensors(activeSensors)
                .minValue(minValue)
                .maxValue(maxValue)
                .avgValue(avgValue)
                .period(HistogramSummary.TimePeriod.builder().start(start).end(end).build())
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

    private boolean hasText(String s) {
        return s != null && !s.trim().isEmpty();
    }

    private boolean isAllSensorType(String s) {
        return !hasText(s) || "ALL".equalsIgnoreCase(s) || "all".equalsIgnoreCase(s);
    }
}
