package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.Building;
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
    private final BuildingService buildingService;
    private final LocationCacheService locationCacheService;
    private final DeviceTypeCacheService deviceTypeCacheService;
    @Autowired
    public DashboardServiceImpl(SensorDao sensorDao, SensorDataDao sensorDataDao,
                                AlertService alertService,
                                BuildingService buildingService,
                                LocationCacheService locationCacheService,
                                DeviceTypeCacheService deviceTypeCacheService) {
        this.sensorDao = sensorDao;
        this.sensorDataDao = sensorDataDao;
        this.alertService = alertService;
        this.buildingService = buildingService;
        this.locationCacheService = locationCacheService;
        this.deviceTypeCacheService = deviceTypeCacheService;
    }

    private Integer mapBuildingToId(String building) {
        if (building == null || "all".equalsIgnoreCase(building)) return null;
        if (isInteger(building)) return Integer.parseInt(building);
        return buildingService.findAll().stream()
                .filter(b -> b.getName().equalsIgnoreCase(building.trim()))
                .map(Building::getId)
                .findFirst()
                .orElse(null);
    }

    private boolean isInteger(String s) {
        try {
            Integer.parseInt(s);
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private Map<Integer, String> loadLocationNameMap() {
        return locationCacheService.loadLocationNameMap();
    }

    private Map<Integer, String> loadDeviceTypeMap() {
        return deviceTypeCacheService.loadDeviceTypeMap();
    }

    @Override
    public DashboardData getDashboardData(String year, String month, String building,
                                          String floor, String sensorType, String timeSlot) {
        sensorType = sensorType != null ? sensorType : "DESK";
        Integer buildingId = mapBuildingToId(building);

        alertService.startMonitoringForBuilding(building, sensorType, buildingId);
        List<Alert> alerts = alertService.getCurrentAlertsWithWait(buildingId, 500);
        List<LiveSensorData> liveSensorData = getLiveSensorData(building, floor, sensorType);
        HistoricalData historicalData = getHistoricalData(year, month, building, floor, sensorType, timeSlot);

        return new DashboardData(alerts, liveSensorData, historicalData);
    }

    private List<Alert> getAlerts(Integer building) {
        return alertService.getCurrentAlerts(building);
    }

    private List<Sensor> findSensorsByType(String sensorType) {
        if (sensorType == null || sensorType.isBlank()) return sensorDao.findAllByDeviceType("DESK");
        if (sensorType.contains(",")) {
            List<String> types = java.util.Arrays.stream(sensorType.split(","))
                    .map(String::trim).filter(s -> !s.isEmpty()).collect(Collectors.toList());
            return sensorDao.findAllByDeviceTypes(types);
        }
        return sensorDao.findAllByDeviceType(sensorType);
    }

    private List<LiveSensorData> getLiveSensorData(String building, String floor, String sensorType) {
        List<LiveSensorData> liveSensorData = new ArrayList<>();
        List<Sensor> filteredSensors = findSensorsByType(sensorType);

        if (building != null && !"all".equalsIgnoreCase(building)) {
            Integer buildingId = mapBuildingToId(building); // ✅ Integer
            filteredSensors = filteredSensors.stream()
                    .filter(s -> buildingId != null && buildingId.equals(s.getBuildingId())) // ✅
                    .collect(Collectors.toList());
        }

        if (floor != null && !floor.equals("all")) {
            filteredSensors = filteredSensors.stream()
                    .filter(sensor -> floor.equals(String.valueOf(sensor.getFloor())))
                    .collect(Collectors.toList());
        }

        // Pre-load latest occupancy data for ALL sensors in ONE query
        List<String> allSensorIds = filteredSensors.stream().map(Sensor::getIdSensor).collect(Collectors.toList());
        Map<String, SensorData> preloadedLatest = allSensorIds.isEmpty()
                ? new HashMap<>()
                : sensorDataDao.findLatestBySensorIdsAndType(allSensorIds, PayloadValueType.OCCUPANCY);

        Map<Integer, String> locationNameMap = loadLocationNameMap();
        Map<String, List<Sensor>> sensorsByLocation = filteredSensors.stream()
                .collect(Collectors.groupingBy(sensor ->
                        sensor.getLocationId() != null
                                ? locationNameMap.getOrDefault(sensor.getLocationId(), "Unknown Location")
                                : "Unknown Location"
                ));

        for (Map.Entry<String, List<Sensor>> entry : sensorsByLocation.entrySet()) {
            String location = entry.getKey();
            List<Sensor> sensorsInLocation = entry.getValue();
            Map<String, Long> stats = calculateOccupancyStats(sensorsInLocation, preloadedLatest);

            liveSensorData.add(new LiveSensorData(
                    location,
                    stats.getOrDefault("free", 0L).intValue(),
                    stats.getOrDefault("used", 0L).intValue(),
                    stats.getOrDefault("invalid", 0L).intValue()
            ));
        }

        Map<String, Long> totalStats = calculateOccupancyStats(filteredSensors, preloadedLatest);
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
        List<String> histSensorIds = filteredSensors.stream().map(Sensor::getIdSensor).collect(Collectors.toList());
        Map<String, SensorData> histPreloaded = histSensorIds.isEmpty()
                ? new HashMap<>()
                : sensorDataDao.findLatestBySensorIdsAndType(histSensorIds, PayloadValueType.OCCUPANCY);
        var selected = calculateOccupancyStats(filteredSensors, histPreloaded);
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
            Integer buildingId = mapBuildingToId(building); // ✅
            deskSensors = deskSensors.stream()
                    .filter(s -> buildingId != null && buildingId.equals(s.getBuildingId())) // ✅
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

        List<String> sensorIds = deskSensors.stream().map(Sensor::getIdSensor).collect(Collectors.toList());
        Map<String, SensorData> latestBySensor = sensorDataDao.findLatestBySensorIdsAndType(sensorIds, PayloadValueType.OCCUPANCY);

        return deskSensors.stream()
                .map(sensor -> {
                    SensorData data = latestBySensor.get(sensor.getIdSensor());
                    String status;
                    if (data == null) {
                        status = "invalid";
                    } else {
                        String valueStr = data.getValueAsString();
                        if (valueStr == null) {
                            status = "free";
                        } else if ("occupied".equalsIgnoreCase(valueStr) || "used".equalsIgnoreCase(valueStr)) {
                            status = "used";
                        } else {
                            try {
                                status = Double.parseDouble(valueStr) > 0 ? "used" : "free";
                            } catch (NumberFormatException e) {
                                status = "free";
                            }
                        }
                    }
                    return new Desk(sensor.getIdSensor(), status);
                })
                .collect(Collectors.toList());
    }

    private Map<String, Long> calculateOccupancyStats(List<Sensor> sensors, Map<String, SensorData> preloadedLatest) {
        if (sensors.isEmpty()) return new HashMap<>();
        LocalDateTime oneHourAgo = LocalDateTime.now().minusHours(1);

        return sensors.stream()
                .map(sensor -> {
                    SensorData data = preloadedLatest.get(sensor.getIdSensor());
                    if (data == null) return "invalid";
                    if (data.getReceivedAt() == null || data.getReceivedAt().isBefore(oneHourAgo)) return "invalid";
                    String valueStr = data.getValueAsString();
                    if (valueStr == null) return "free";
                    if ("occupied".equalsIgnoreCase(valueStr) || "used".equalsIgnoreCase(valueStr)) return "used";
                    if ("free".equalsIgnoreCase(valueStr)) return "free";
                    try {
                        return Double.parseDouble(valueStr) > 0 ? "used" : "free";
                    } catch (NumberFormatException e) {
                        return "free";
                    }
                })
                .collect(Collectors.groupingBy(s -> s, Collectors.counting()));
    }
    @Override
    public List<SensorInfo> getSensorsList(String building, String floor, String sensorType) {
        log.info("Fetching sensors list: building={}, floor={}, sensorType={}", building, floor, sensorType);

        if (sensorType == null) sensorType = "DESK";

        List<Sensor> sensors = findSensorsByType(sensorType);

        if (building != null && !"all".equalsIgnoreCase(building)) {
            Integer buildingId = mapBuildingToId(building); // ✅ résolution ici
            sensors = sensors.stream()
                    .filter(s -> buildingId != null && buildingId.equals(s.getBuildingId())) // ✅ Integer.equals()
                    .collect(Collectors.toList());
        }

        if (floor != null && !"all".equalsIgnoreCase(floor)) {
            sensors = sensors.stream()
                    .filter(s -> floor.equals(String.valueOf(s.getFloor())))
                    .collect(Collectors.toList());
        }

        Map<Integer, String> deviceTypeMap = loadDeviceTypeMap();
        Map<Integer, String> locationNameMap = loadLocationNameMap();

        return sensors.stream()
                .map(s -> new SensorInfo(
                        s.getIdSensor(),
                        deviceTypeMap.getOrDefault(s.getIdDeviceType(), "UNKNOWN"),
                        s.getLocationId() != null ? locationNameMap.getOrDefault(s.getLocationId(), null) : null,
                        s.getBuildingId() != null ? String.valueOf(s.getBuildingId()) : null,
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
            Integer buildingId = mapBuildingToId(request.getBuilding());
            sensors = sensors.stream()
                    .filter(s -> buildingId != null && buildingId.equals(s.getBuildingId()))
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
            case TODAY -> start = LocalDateTime.now().truncatedTo(ChronoUnit.DAYS);
            case LAST_7_DAYS -> start = end.minusDays(6).truncatedTo(ChronoUnit.DAYS);
            case LAST_30_DAYS -> start = end.minusDays(29).truncatedTo(ChronoUnit.DAYS);
            case THIS_MONTH -> start = end.withDayOfMonth(1).truncatedTo(ChronoUnit.DAYS);
            case LAST_MONTH -> {
                start = end.minusMonths(1).withDayOfMonth(1).truncatedTo(ChronoUnit.DAYS);
                end = end.withDayOfMonth(1).minusDays(1).truncatedTo(ChronoUnit.DAYS).plusDays(1).minusSeconds(1);
            }
            case CUSTOM -> {
                if (request.getCustomStartDate() != null && request.getCustomEndDate() != null) {
                    start = LocalDateTime.ofInstant(request.getCustomStartDate().toInstant(),
                            java.time.ZoneId.systemDefault()).truncatedTo(ChronoUnit.DAYS);
                    end = LocalDateTime.ofInstant(request.getCustomEndDate().toInstant(),
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
            if (!totalMode) {
                // Single query for the full range, grouped by date in SQL
                Map<String, Map<String, SensorDataDao.HourlyStatistics>> byDate =
                        sensorDataDao.getDailyStatisticsBatchForRange(sensorIds, request.getMetricType(), start, end);
                for (Map.Entry<String, Map<String, SensorDataDao.HourlyStatistics>> entry : byDate.entrySet()) {
                    if (entry.getValue() != null && !entry.getValue().isEmpty()) {
                        dataMap.put(entry.getKey(), new ArrayList<>(entry.getValue().values()));
                    }
                }
            } else {
                // Total mode: one query per metric part, then aggregate in memory
                Map<String, Map<String, Double>> sumAbsByDateSensor = new HashMap<>();
                Map<String, Map<String, Integer>> maxCountByDateSensor = new HashMap<>();
                for (PayloadValueType part : metricParts) {
                    Map<String, Map<String, SensorDataDao.HourlyStatistics>> byDate =
                            sensorDataDao.getDailyStatisticsBatchForRange(sensorIds, part, start, end);
                    for (Map.Entry<String, Map<String, SensorDataDao.HourlyStatistics>> dateEntry : byDate.entrySet()) {
                        String day = dateEntry.getKey();
                        for (Map.Entry<String, SensorDataDao.HourlyStatistics> se : dateEntry.getValue().entrySet()) {
                            sumAbsByDateSensor.computeIfAbsent(day, k -> new HashMap<>())
                                    .merge(se.getKey(), Math.abs(se.getValue().getAverage()), Double::sum);
                            maxCountByDateSensor.computeIfAbsent(day, k -> new HashMap<>())
                                    .merge(se.getKey(), se.getValue().getDataPointCount(), Math::max);
                        }
                    }
                }
                for (Map.Entry<String, Map<String, Double>> dateEntry : sumAbsByDateSensor.entrySet()) {
                    String day = dateEntry.getKey();
                    List<SensorDataDao.HourlyStatistics> merged = new ArrayList<>();
                    for (Map.Entry<String, Double> se : dateEntry.getValue().entrySet()) {
                        int cnt = maxCountByDateSensor.getOrDefault(day, Map.of()).getOrDefault(se.getKey(), 0);
                        merged.add(new SensorDataDao.HourlyStatistics(se.getValue(), se.getValue(), se.getValue(), cnt));
                    }
                    if (!merged.isEmpty()) dataMap.put(day, merged);
                }
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

    // Ajouter un nouveau type ici suffit pour le rendre dynamique partout
    // { typeName -> { metricName -> decodedFieldName } }
    private static final Map<String, Map<String, String>> SENSOR_METRIC_CONFIG = new LinkedHashMap<>();
    static {
        SENSOR_METRIC_CONFIG.put("CO2",    Map.of("co2", "co2", "temperature", "temperature", "humidity", "humidity"));
        SENSOR_METRIC_CONFIG.put("TEMPEX", Map.of("temperature", "temperature", "humidity", "humidity"));
        SENSOR_METRIC_CONFIG.put("SON",    Map.of("sound", "LAeq"));
        SENSOR_METRIC_CONFIG.put("CONSO",  Map.of("energy", "energy_data"));
        SENSOR_METRIC_CONFIG.put("ENERGY", Map.of("energy", "energy_data"));
        SENSOR_METRIC_CONFIG.put("EYE",    Map.of("temperature", "temperature", "humidity", "humidity", "light", "light"));
        SENSOR_METRIC_CONFIG.put("DESK",   Map.of("occupancy", "occupancy", "temperature", "temperature", "humidity", "humidity"));
    }

    @Override
    public Map<String, Object> getEnvConfig(String building, Integer floor) {
        List<Map<String, Object>> rows = sensorDao.findAllByBuildingAndFloorForConfig(building, floor);

        Map<String, List<String>> zones = new LinkedHashMap<>();
        Map<String, Set<String>> zoneMetrics = new LinkedHashMap<>();
        Map<String, String> fieldMapping = new LinkedHashMap<>();

        for (Map<String, Object> row : rows) {
            String deviceId = (String) row.get("id_sensor");
            String location = (String) row.get("name");
            String type     = (String) row.get("type_name");

            Map<String, String> typeConfig = SENSOR_METRIC_CONFIG.get(type);
            if (typeConfig == null) continue;

            zones.computeIfAbsent(location, z -> new ArrayList<>()).add(deviceId);
            zoneMetrics.computeIfAbsent(location, z -> new LinkedHashSet<>()).addAll(typeConfig.keySet());
            typeConfig.forEach(fieldMapping::putIfAbsent);
        }

        Set<String> globalMetrics = new LinkedHashSet<>();
        List<Map<String, Object>> zonesList = zones.entrySet().stream()
                .filter(e -> e.getKey() != null && !e.getKey().isBlank())
                .map(e -> {
                    Set<String> zm = zoneMetrics.getOrDefault(e.getKey(), new LinkedHashSet<>());
                    globalMetrics.addAll(zm);
                    Map<String, Object> z = new LinkedHashMap<>();
                    z.put("name", e.getKey());
                    z.put("deviceIds", e.getValue());
                    z.put("metrics", new ArrayList<>(zm));
                    return z;
                })
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("building", building);
        result.put("floor", floor);
        result.put("zones", zonesList);
        result.put("metrics", new ArrayList<>(globalMetrics));
        result.put("fieldMapping", fieldMapping);
        return result;
    }

    private boolean hasText(String s) {
        return s != null && !s.trim().isEmpty();
    }

    private boolean isAllSensorType(String s) {
        return !hasText(s) || "ALL".equalsIgnoreCase(s) || "all".equalsIgnoreCase(s);
    }
}
