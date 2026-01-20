package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.amaris.sensorprocessor.entity.SensorData;
import com.amaris.sensorprocessor.model.analytics.OccupancyStats;
import com.amaris.sensorprocessor.model.analytics.SectionOccupancyResponse;
import com.amaris.sensorprocessor.repository.SensorDataDao;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class OccupancyAnalyticsService {

    private final SensorDataDao sensorDataDao;
    private final JdbcTemplate jdbcTemplate;

    // Business hours: 9h-12h30 and 14h-18h30
    private static final int MORNING_START = 9;
    private static final int MORNING_END_HOUR = 12;
    private static final int MORNING_END_MINUTE = 30;
    private static final int AFTERNOON_START = 14;
    private static final int AFTERNOON_END_HOUR = 18;
    private static final int AFTERNOON_END_MINUTE = 30;
    
    // 30-minute interval
    private static final int INTERVAL_MINUTES = 30;

    /**
     * Get occupancy analytics for a specific section
     */
    public SectionOccupancyResponse getSectionOccupancy(String sectionType, String startDateStr, String endDateStr) {
        List<String> sensorIds = getSensorIdsBySection(sectionType);
        String sectionName = getSectionName(sectionType);
        
        log.info("Calculating occupancy for section: {} with {} sensors (dates: {} to {})", 
                sectionName, sensorIds.size(), startDateStr, endDateStr);

        // Parse custom dates if provided
        LocalDate customStartDate = null;
        LocalDate customEndDate = null;
        
        if (startDateStr != null && endDateStr != null) {
            try {
                // Parse datetime-local format: "2026-01-20T09:00"
                customStartDate = LocalDateTime.parse(startDateStr).toLocalDate();
                customEndDate = LocalDateTime.parse(endDateStr).toLocalDate();
                log.info("Using custom date range: {} to {}", customStartDate, customEndDate);
            } catch (Exception e) {
                log.warn("Failed to parse custom dates, using defaults: {}", e.getMessage());
            }
        }

        // Calculate stats for each sensor
        final LocalDate finalStartDate = customStartDate;
        final LocalDate finalEndDate = customEndDate;
        
        // OPTIMIZED: Use bulk calculation for sections with many sensors
        List<OccupancyStats> sensorStats;
        if (sensorIds.size() > 5) {
            log.info("⚡ Using BULK optimization for {} sensors", sensorIds.size());
            Map<String, OccupancyStats> bulkResults = calculateBulkSensorOccupancy(sensorIds, finalStartDate, finalEndDate);
            sensorStats = sensorIds.stream()
                    .map(id -> bulkResults.getOrDefault(id, createEmptyStats(id)))
                    .collect(Collectors.toList());
        } else {
            log.info("Using individual calculation for {} sensors", sensorIds.size());
            sensorStats = sensorIds.stream()
                    .map(sensorId -> calculateSensorOccupancyWithDates(sensorId, finalStartDate, finalEndDate))
                    .collect(Collectors.toList());
        }

        // Calculate global stats for the section
        OccupancyStats globalStats = calculateGlobalStatsWithDates(
                sectionName + " - Global", sensorIds, finalStartDate, finalEndDate);

        return SectionOccupancyResponse.builder()
                .sectionName(sectionName)
                .sensorStats(sensorStats)
                .globalStats(globalStats)
                .calculationMethod("Méthode 1: Occupation détectée au moins une fois par intervalle de 30 minutes")
                .businessHours("9h00-12h30 et 14h00-18h30")
                .workingDays("Lundi à Vendredi")
                .build();
    }

    /**
     * Calculate occupancy stats for a single sensor with custom date range
     * OPTIMIZED: Reuses bulk-fetched data instead of individual queries
     */
    private OccupancyStats calculateSensorOccupancyWithDates(String sensorId, LocalDate customStart, LocalDate customEnd) {
        LocalDate today = (customEnd != null) ? customEnd : LocalDate.now();
        LocalDate start = (customStart != null) ? customStart : LocalDate.now().minusDays(30);
        
        // If custom dates provided, use full range for all stats
        if (customStart != null && customEnd != null) {
            Map<String, Integer> rangeStats = calculateOccupancyForPeriod(sensorId, customStart, customEnd.plusDays(1));
            
            return OccupancyStats.builder()
                    .sensorId(sensorId)
                    .sensorName(formatSensorName(sensorId))
                    .dailyOccupancyRate(calculateRate(rangeStats))
                    .dailyOccupiedIntervals(rangeStats.get("occupied"))
                    .dailyTotalIntervals(rangeStats.get("total"))
                    .weeklyOccupancyRate(calculateRate(rangeStats))
                    .weeklyOccupiedIntervals(rangeStats.get("occupied"))
                    .weeklyTotalIntervals(rangeStats.get("total"))
                    .monthlyOccupancyRate(calculateRate(rangeStats))
                    .monthlyOccupiedIntervals(rangeStats.get("occupied"))
                    .monthlyTotalIntervals(rangeStats.get("total"))
                    .build();
        }
        
        // Default behavior: calculate day/week/month separately
        LocalDate weekStart = today.with(DayOfWeek.MONDAY);
        LocalDate monthStart = today.with(TemporalAdjusters.firstDayOfMonth());

        Map<String, Integer> dailyStats = calculateOccupancyForPeriod(sensorId, today, today.plusDays(1));
        Map<String, Integer> weeklyStats = calculateOccupancyForPeriod(sensorId, weekStart, today.plusDays(1));
        Map<String, Integer> monthlyStats = calculateOccupancyForPeriod(sensorId, monthStart, today.plusDays(1));

        return OccupancyStats.builder()
                .sensorId(sensorId)
                .sensorName(formatSensorName(sensorId))
                .dailyOccupancyRate(calculateRate(dailyStats))
                .dailyOccupiedIntervals(dailyStats.get("occupied"))
                .dailyTotalIntervals(dailyStats.get("total"))
                .weeklyOccupancyRate(calculateRate(weeklyStats))
                .weeklyOccupiedIntervals(weeklyStats.get("occupied"))
                .weeklyTotalIntervals(weeklyStats.get("total"))
                .monthlyOccupancyRate(calculateRate(monthlyStats))
                .monthlyOccupiedIntervals(monthlyStats.get("occupied"))
                .monthlyTotalIntervals(monthlyStats.get("total"))
                .build();
    }
    
    /**
     * OPTIMIZED: Calculate stats for multiple sensors in one bulk query
     */
    private Map<String, OccupancyStats> calculateBulkSensorOccupancy(List<String> sensorIds, LocalDate customStart, LocalDate customEnd) {
        log.info("🚀 BULK calculation for {} sensors", sensorIds.size());
        
        LocalDate today = (customEnd != null) ? customEnd : LocalDate.now();
        LocalDate monthStart = (customStart != null) ? customStart : today.with(TemporalAdjusters.firstDayOfMonth());
        LocalDate weekStart = today.with(DayOfWeek.MONDAY);
        
        // Fetch ALL data in ONE query
        LocalDateTime startDateTime = monthStart.atTime(MORNING_START, 0);
        LocalDateTime endDateTime = today.plusDays(1).atStartOfDay();
        
        log.info("📡 Fetching bulk data from {} to {}", startDateTime, endDateTime);
        
        String inClause = sensorIds.stream()
                .map(id -> "?")
                .collect(Collectors.joining(","));
        
        String query = String.format("""
            SELECT id_sensor, received_at, value 
            FROM sensor_data 
            WHERE id_sensor IN (%s)
            AND value_type = 'OCCUPANCY'
            AND received_at >= ? 
            AND received_at < ?
            ORDER BY id_sensor, received_at
            """, inClause);
        
        // Build parameter array
        Object[] params = new Object[sensorIds.size() + 2];
        for (int i = 0; i < sensorIds.size(); i++) {
            params[i] = sensorIds.get(i);
        }
        params[sensorIds.size()] = startDateTime;
        params[sensorIds.size() + 1] = endDateTime;
        
        // Fetch all data in ONE query
        List<Map<String, Object>> allData = jdbcTemplate.queryForList(query, params);
        log.info("✅ Fetched {} rows for {} sensors", allData.size(), sensorIds.size());
        
        // Group data by sensor
        Map<String, List<Map<String, Object>>> dataPerSensor = allData.stream()
                .collect(Collectors.groupingBy(row -> (String) row.get("id_sensor")));
        
        // Process each sensor in memory
        Map<String, OccupancyStats> results = new HashMap<>();
        
        for (String sensorId : sensorIds) {
            List<Map<String, Object>> sensorData = dataPerSensor.getOrDefault(sensorId, new ArrayList<>());
            
            // Calculate stats from in-memory data
            Map<String, Integer> dailyStats = calculateStatsFromData(sensorData, today, today.plusDays(1));
            Map<String, Integer> weeklyStats = calculateStatsFromData(sensorData, weekStart, today.plusDays(1));
            Map<String, Integer> monthlyStats = calculateStatsFromData(sensorData, monthStart, today.plusDays(1));
            
            OccupancyStats stats = OccupancyStats.builder()
                    .sensorId(sensorId)
                    .sensorName(formatSensorName(sensorId))
                    .dailyOccupancyRate(calculateRate(dailyStats))
                    .dailyOccupiedIntervals(dailyStats.get("occupied"))
                    .dailyTotalIntervals(dailyStats.get("total"))
                    .weeklyOccupancyRate(calculateRate(weeklyStats))
                    .weeklyOccupiedIntervals(weeklyStats.get("occupied"))
                    .weeklyTotalIntervals(weeklyStats.get("total"))
                    .monthlyOccupancyRate(calculateRate(monthlyStats))
                    .monthlyOccupiedIntervals(monthlyStats.get("occupied"))
                    .monthlyTotalIntervals(monthlyStats.get("total"))
                    .build();
            
            results.put(sensorId, stats);
        }
        
        log.info("✅ Processed {} sensors in memory", results.size());
        return results;
    }
    
    /**
     * Calculate occupancy stats from in-memory data
     */
    private Map<String, Integer> calculateStatsFromData(List<Map<String, Object>> data, LocalDate startDate, LocalDate endDate) {
        // Generate all 30-min intervals
        List<LocalDateTime> intervals = generateIntervals(startDate, endDate);
        
        int occupiedCount = 0;
        
        for (LocalDateTime intervalStart : intervals) {
            LocalDateTime intervalEnd = intervalStart.plusMinutes(INTERVAL_MINUTES);
            
            // Check if any data point in this interval shows occupancy
            boolean occupied = data.stream().anyMatch(row -> {
                try {
                    Object receivedAtObj = row.get("received_at");
                    if (receivedAtObj == null) return false;
                    
                    LocalDateTime timestamp;
                    if (receivedAtObj instanceof java.sql.Timestamp) {
                        timestamp = ((java.sql.Timestamp) receivedAtObj).toLocalDateTime();
                    } else if (receivedAtObj instanceof LocalDateTime) {
                        timestamp = (LocalDateTime) receivedAtObj;
                    } else {
                        return false;
                    }
                    
                    // Check if timestamp is within interval [start, end)
                    if (timestamp.isBefore(intervalStart) || !timestamp.isBefore(intervalEnd)) {
                        return false;
                    }
                    
                    String value = (String) row.get("value");
                    if (value == null) return false;
                    
                    try {
                        return Integer.parseInt(value) > 0;
                    } catch (NumberFormatException e) {
                        return "occupied".equalsIgnoreCase(value) || "used".equalsIgnoreCase(value);
                    }
                } catch (Exception e) {
                    return false;
                }
            });
            
            if (occupied) occupiedCount++;
        }
        
        Map<String, Integer> result = new HashMap<>();
        result.put("occupied", occupiedCount);
        result.put("total", intervals.size());
        return result;
    }
    
    /**
     * Create empty stats for sensor with no data
     */
    private OccupancyStats createEmptyStats(String sensorId) {
        return OccupancyStats.builder()
                .sensorId(sensorId)
                .sensorName(formatSensorName(sensorId))
                .dailyOccupancyRate(0.0)
                .dailyOccupiedIntervals(0)
                .dailyTotalIntervals(0)
                .weeklyOccupancyRate(0.0)
                .weeklyOccupiedIntervals(0)
                .weeklyTotalIntervals(0)
                .monthlyOccupancyRate(0.0)
                .monthlyOccupiedIntervals(0)
                .monthlyTotalIntervals(0)
                .build();
    }

    /**
     * Calculate global stats for all sensors in a section with custom dates
     */
    private OccupancyStats calculateGlobalStatsWithDates(String name, List<String> sensorIds, LocalDate customStart, LocalDate customEnd) {
        LocalDate today = (customEnd != null) ? customEnd : LocalDate.now();
        
        if (customStart != null && customEnd != null) {
            Map<String, Integer> rangeStats = calculateGlobalOccupancyForPeriod(
                    sensorIds, customStart, customEnd.plusDays(1));
            
            return OccupancyStats.builder()
                    .sensorId("GLOBAL")
                    .sensorName(name)
                    .dailyOccupancyRate(calculateRate(rangeStats))
                    .dailyOccupiedIntervals(rangeStats.get("occupied"))
                    .dailyTotalIntervals(rangeStats.get("total"))
                    .weeklyOccupancyRate(calculateRate(rangeStats))
                    .weeklyOccupiedIntervals(rangeStats.get("occupied"))
                    .weeklyTotalIntervals(rangeStats.get("total"))
                    .monthlyOccupancyRate(calculateRate(rangeStats))
                    .monthlyOccupiedIntervals(rangeStats.get("occupied"))
                    .monthlyTotalIntervals(rangeStats.get("total"))
                    .build();
        }
        
        LocalDate weekStart = today.with(DayOfWeek.MONDAY);
        LocalDate monthStart = today.with(TemporalAdjusters.firstDayOfMonth());

        Map<String, Integer> dailyStats = calculateGlobalOccupancyForPeriod(
                sensorIds, today, today.plusDays(1));
        
        Map<String, Integer> weeklyStats = calculateGlobalOccupancyForPeriod(
                sensorIds, weekStart, today.plusDays(1));
        
        Map<String, Integer> monthlyStats = calculateGlobalOccupancyForPeriod(
                sensorIds, monthStart, today.plusDays(1));

        return OccupancyStats.builder()
                .sensorId("GLOBAL")
                .sensorName(name)
                .dailyOccupancyRate(calculateRate(dailyStats))
                .dailyOccupiedIntervals(dailyStats.get("occupied"))
                .dailyTotalIntervals(dailyStats.get("total"))
                .weeklyOccupancyRate(calculateRate(weeklyStats))
                .weeklyOccupiedIntervals(weeklyStats.get("occupied"))
                .weeklyTotalIntervals(weeklyStats.get("total"))
                .monthlyOccupancyRate(calculateRate(monthlyStats))
                .monthlyOccupiedIntervals(monthlyStats.get("occupied"))
                .monthlyTotalIntervals(monthlyStats.get("total"))
                .build();
    }

    /**
     * Calculate occupancy for a single sensor over a period using 30-min intervals
     */
    private Map<String, Integer> calculateOccupancyForPeriod(
            String sensorId, LocalDate startDate, LocalDate endDate) {
        
        int totalIntervals = 0;
        int occupiedIntervals = 0;

        // Iterate through each day in the period
        LocalDate currentDate = startDate;
        while (!currentDate.isAfter(endDate.minusDays(1))) {
            // Skip weekends
            if (currentDate.getDayOfWeek() == DayOfWeek.SATURDAY || 
                currentDate.getDayOfWeek() == DayOfWeek.SUNDAY) {
                currentDate = currentDate.plusDays(1);
                continue;
            }

            // Generate 30-min intervals for business hours
            List<LocalDateTime> intervals = generateBusinessHoursIntervals(currentDate);
            
            for (LocalDateTime intervalStart : intervals) {
                LocalDateTime intervalEnd = intervalStart.plusMinutes(INTERVAL_MINUTES);
                
                // Check if there's at least one occupied measurement in this interval
                boolean isOccupied = isIntervalOccupied(sensorId, intervalStart, intervalEnd);
                
                totalIntervals++;
                if (isOccupied) {
                    occupiedIntervals++;
                }
            }

            currentDate = currentDate.plusDays(1);
        }

        Map<String, Integer> result = new HashMap<>();
        result.put("occupied", occupiedIntervals);
        result.put("total", totalIntervals);
        return result;
    }

    /**
     * Calculate global occupancy for multiple sensors
     */
    private Map<String, Integer> calculateGlobalOccupancyForPeriod(
            List<String> sensorIds, LocalDate startDate, LocalDate endDate) {
        
        int totalIntervals = 0;
        int occupiedIntervals = 0;

        for (String sensorId : sensorIds) {
            Map<String, Integer> sensorStats = calculateOccupancyForPeriod(sensorId, startDate, endDate);
            totalIntervals += sensorStats.get("total");
            occupiedIntervals += sensorStats.get("occupied");
        }

        Map<String, Integer> result = new HashMap<>();
        result.put("occupied", occupiedIntervals);
        result.put("total", totalIntervals);
        return result;
    }

    /**
     * Check if a 30-min interval has at least one occupied measurement
     */
    private boolean isIntervalOccupied(String sensorId, LocalDateTime start, LocalDateTime end) {
        try {
            String query = """
                SELECT value FROM sensor_data 
                WHERE id_sensor = ? 
                AND value_type = 'OCCUPANCY'
                AND received_at >= ? 
                AND received_at < ?
                ORDER BY received_at
                """;
            
            List<Map<String, Object>> results = jdbcTemplate.queryForList(
                    query, sensorId, start, end);
            
            // Check if any value is > 0 (occupied)
            for (Map<String, Object> row : results) {
                String value = (String) row.get("value");
                if (value != null) {
                    try {
                        int occupancyValue = Integer.parseInt(value);
                        if (occupancyValue > 0) {
                            return true;
                        }
                    } catch (NumberFormatException e) {
                        // Check string values
                        if ("occupied".equalsIgnoreCase(value) || "used".equalsIgnoreCase(value)) {
                            return true;
                        }
                    }
                }
            }
            
            return false;
        } catch (Exception e) {
            log.error("Error checking interval occupancy for sensor {}: {}", sensorId, e.getMessage());
            return false;
        }
    }

    /**
     * Generate 30-minute intervals for business hours over multiple days
     */
    private List<LocalDateTime> generateIntervals(LocalDate startDate, LocalDate endDate) {
        List<LocalDateTime> allIntervals = new ArrayList<>();
        
        LocalDate currentDate = startDate;
        while (!currentDate.isAfter(endDate.minusDays(1))) {
            // Skip weekends
            if (currentDate.getDayOfWeek() != DayOfWeek.SATURDAY && 
                currentDate.getDayOfWeek() != DayOfWeek.SUNDAY) {
                allIntervals.addAll(generateBusinessHoursIntervals(currentDate));
            }
            currentDate = currentDate.plusDays(1);
        }
        
        return allIntervals;
    }

    /**
     * Generate 30-minute intervals for business hours of a day
     */
    private List<LocalDateTime> generateBusinessHoursIntervals(LocalDate date) {
        List<LocalDateTime> intervals = new ArrayList<>();

        // Morning: 9h00 - 12h30
        LocalDateTime morningStart = date.atTime(MORNING_START, 0);
        LocalDateTime morningEnd = date.atTime(MORNING_END_HOUR, MORNING_END_MINUTE);
        
        LocalDateTime current = morningStart;
        while (current.isBefore(morningEnd)) {
            intervals.add(current);
            current = current.plusMinutes(INTERVAL_MINUTES);
        }

        // Afternoon: 14h00 - 18h30
        LocalDateTime afternoonStart = date.atTime(AFTERNOON_START, 0);
        LocalDateTime afternoonEnd = date.atTime(AFTERNOON_END_HOUR, AFTERNOON_END_MINUTE);
        
        current = afternoonStart;
        while (current.isBefore(afternoonEnd)) {
            intervals.add(current);
            current = current.plusMinutes(INTERVAL_MINUTES);
        }

        return intervals;
    }

    /**
     * Calculate occupancy rate percentage
     */
    private double calculateRate(Map<String, Integer> stats) {
        int total = stats.get("total");
        if (total == 0) return 0.0;
        
        int occupied = stats.get("occupied");
        return Math.round((occupied * 100.0 / total) * 100.0) / 100.0; // Round to 2 decimals
    }

    /**
     * Get sensor IDs by section type
     */
    private List<String> getSensorIdsBySection(String sectionType) {
        return switch (sectionType.toLowerCase()) {
            case "desk" -> generateDeskSensorIds();
            case "meeting" -> Arrays.asList("occup-vs70-03-01", "occup-vs70-03-02", "count-03-01");
            case "phone" -> Arrays.asList(
                    "desk-vs41-03-03", "desk-vs41-03-04", "occup-vs30-03-01", 
                    "occup-vs30-03-02", "desk-vs40-03-01", "occup-vs70-03-03", 
                    "occup-vs70-03-04");
            case "interview" -> Arrays.asList("desk-vs41-03-01", "desk-vs41-03-02");
            default -> Collections.emptyList();
        };
    }

    /**
     * Generate desk sensor IDs from desk-03-01 to desk-03-90
     */
    private List<String> generateDeskSensorIds() {
        List<String> ids = new ArrayList<>();
        for (int i = 1; i <= 90; i++) {
            ids.add(String.format("desk-03-%02d", i));
        }
        return ids;
    }

    /**
     * Get section display name
     */
    private String getSectionName(String sectionType) {
        return switch (sectionType.toLowerCase()) {
            case "desk" -> "Desk-Bureau-Standard";
            case "meeting" -> "Salle de Réunion";
            case "phone" -> "Phone Booth";
            case "interview" -> "Interview Room";
            default -> "Unknown Section";
        };
    }

    /**
     * Format sensor name for display
     */
    private String formatSensorName(String sensorId) {
        if (sensorId.startsWith("desk-03-")) {
            return "Desk " + sensorId.substring(8);
        } else if (sensorId.startsWith("occup-vs70-03-")) {
            return "SR" + sensorId.substring(14);
        } else if (sensorId.equals("count-03-01")) {
            return "SR3";
        } else if (sensorId.startsWith("desk-vs41-03-")) {
            String num = sensorId.substring(13);
            if (num.equals("01") || num.equals("02")) {
                return "IR" + num;
            }
            return "PB" + num;
        } else if (sensorId.startsWith("occup-vs30-03-")) {
            return "PB" + (Integer.parseInt(sensorId.substring(14)) + 2);
        } else if (sensorId.equals("desk-vs40-03-01")) {
            return "PB5";
        } else if (sensorId.startsWith("occup-vs70-03-")) {
            return "PB" + (Integer.parseInt(sensorId.substring(14)) + 5);
        }
        return sensorId;
    }
}
