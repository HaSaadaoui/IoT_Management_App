package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.amaris.sensorprocessor.entity.SensorData;
import com.amaris.sensorprocessor.model.analytics.*;
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

    private static final ZoneId PARIS_ZONE = ZoneId.of("Europe/Paris");
    private static final ZoneId UTC_ZONE = ZoneId.of("UTC");

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
                .calculationMethod("Taux = (Intervalles Occupés / Intervalles avec Données) × 100. Compte uniquement les intervalles où le capteur a envoyé des données.")
                .businessHours("9h00-12h30 et 14h00-18h30")
                .workingDays("Lundi à Vendredi")
                .build();
    }

    /**
     * Calculate occupancy stats for a single sensor with custom date range
     * New logic: Daily = start date, Weekly = start + 7d, Monthly = start + 30d
     */
    private OccupancyStats calculateSensorOccupancyWithDates(String sensorId, LocalDate customStart, LocalDate customEnd) {
        // If no custom dates provided, return empty stats
        if (customStart == null || customEnd == null) {
            return createEmptyStats(sensorId);
        }
        
        long daysBetween = ChronoUnit.DAYS.between(customStart, customEnd);
        
        // Daily: Start date only (1 day)
        Map<String, Integer> dailyStats = calculateOccupancyForPeriod(sensorId, customStart, customStart.plusDays(1));
        
        // Weekly: Start date + 7 days (only if range >= 7 days)
        Map<String, Integer> weeklyStats = null;
        if (daysBetween >= 7) {
            LocalDate weekEnd = customStart.plusDays(7);
            if (weekEnd.isAfter(customEnd)) weekEnd = customEnd;
            weeklyStats = calculateOccupancyForPeriod(sensorId, customStart, weekEnd.plusDays(1));
        }
        
        // Monthly: Start date + 30 days (only if range >= 30 days)
        Map<String, Integer> monthlyStats = null;
        if (daysBetween >= 30) {
            LocalDate monthEnd = customStart.plusDays(30);
            if (monthEnd.isAfter(customEnd)) monthEnd = customEnd;
            monthlyStats = calculateOccupancyForPeriod(sensorId, customStart, monthEnd.plusDays(1));
        }

        return OccupancyStats.builder()
                .sensorId(sensorId)
                .sensorName(formatSensorName(sensorId))
                .dailyOccupancyRate(calculateRate(dailyStats))
                .dailyOccupiedIntervals(dailyStats.get("occupied"))
                .dailyTotalIntervals(dailyStats.get("total"))
                .weeklyOccupancyRate(weeklyStats != null ? calculateRate(weeklyStats) : 0.0)
                .weeklyOccupiedIntervals(weeklyStats != null ? weeklyStats.get("occupied") : 0)
                .weeklyTotalIntervals(weeklyStats != null ? weeklyStats.get("total") : 0)
                .monthlyOccupancyRate(monthlyStats != null ? calculateRate(monthlyStats) : 0.0)
                .monthlyOccupiedIntervals(monthlyStats != null ? monthlyStats.get("occupied") : 0)
                .monthlyTotalIntervals(monthlyStats != null ? monthlyStats.get("total") : 0)
                .build();
    }
    
    /**
     * OPTIMIZED: Calculate stats for multiple sensors in one bulk query
     * New logic: Daily=startDate, Weekly=startDate+7d, Monthly=startDate+30d
     */
    private Map<String, OccupancyStats> calculateBulkSensorOccupancy(List<String> sensorIds, LocalDate customStart, LocalDate customEnd) {
        log.info("🚀 BULK calculation for {} sensors", sensorIds.size());
        
        // Require custom dates for bulk calculation
        if (customStart == null || customEnd == null) {
            Map<String, OccupancyStats> emptyResults = new HashMap<>();
            for (String sensorId : sensorIds) {
                emptyResults.put(sensorId, createEmptyStats(sensorId));
            }
            return emptyResults;
        }
        
        long daysBetween = ChronoUnit.DAYS.between(customStart, customEnd);
        
        // Determine date ranges for daily/weekly/monthly
        LocalDate dailyEnd = customStart.plusDays(1);
        LocalDate weeklyEnd = daysBetween >= 7 ? customStart.plusDays(7) : null;
        LocalDate monthlyEnd = daysBetween >= 30 ? customStart.plusDays(30) : null;
        
        // Fetch data from start date to max end date needed
        LocalDate maxEndDate = customStart.plusDays(1);
        if (monthlyEnd != null && monthlyEnd.isBefore(customEnd)) maxEndDate = monthlyEnd;
        else if (weeklyEnd != null && weeklyEnd.isBefore(customEnd)) maxEndDate = weeklyEnd;
        else if (customEnd != null) maxEndDate = customEnd;
        
        // Azure MySQL stores received_at in UTC; fetch a full-day UTC range to avoid timezone edge issues.
        LocalDateTime startDateTime = customStart.atStartOfDay();
        LocalDateTime endDateTime = maxEndDate.plusDays(1).atStartOfDay();
        
        log.info("📡 Fetching bulk data from {} to {} (range: {} days)", startDateTime, endDateTime, daysBetween);
        
        String inClause = sensorIds.stream()
                .map(id -> "?")
                .collect(Collectors.joining(","));
        
        String query = String.format("""
            SELECT id_sensor, received_at, value, value_type 
            FROM sensor_data 
            WHERE id_sensor IN (%s)
            AND value_type IN ('OCCUPANCY', 'PERIOD_IN', 'PERIOD_OUT')
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
            
            // Calculate stats from in-memory data with new date logic
            Map<String, Integer> dailyStats = calculateStatsFromData(sensorData, customStart, dailyEnd);
            
            Map<String, Integer> weeklyStats = null;
            if (weeklyEnd != null) {
                weeklyStats = calculateStatsFromData(sensorData, customStart, weeklyEnd);
            }
            
            Map<String, Integer> monthlyStats = null;
            if (monthlyEnd != null) {
                monthlyStats = calculateStatsFromData(sensorData, customStart, monthlyEnd);
            }
            
            OccupancyStats stats = OccupancyStats.builder()
                    .sensorId(sensorId)
                    .sensorName(formatSensorName(sensorId))
                    .dailyOccupancyRate(calculateRate(dailyStats))
                    .dailyOccupiedIntervals(dailyStats.get("occupied"))
                    .dailyTotalIntervals(dailyStats.get("total"))
                    .weeklyOccupancyRate(weeklyStats != null ? calculateRate(weeklyStats) : 0.0)
                    .weeklyOccupiedIntervals(weeklyStats != null ? weeklyStats.get("occupied") : 0)
                    .weeklyTotalIntervals(weeklyStats != null ? weeklyStats.get("total") : 0)
                    .monthlyOccupancyRate(monthlyStats != null ? calculateRate(monthlyStats) : 0.0)
                    .monthlyOccupiedIntervals(monthlyStats != null ? monthlyStats.get("occupied") : 0)
                    .monthlyTotalIntervals(monthlyStats != null ? monthlyStats.get("total") : 0)
                    .build();
            
            results.put(sensorId, stats);
        }
        
        log.info("✅ Processed {} sensors in memory", results.size());
        return results;
    }
    
    /**
     * Calculate occupancy stats from in-memory data
     * NEW LOGIC: Only count intervals where sensor sent data
     */
    private Map<String, Integer> calculateStatsFromData(List<Map<String, Object>> data, LocalDate startDate, LocalDate endDate) {
        // Generate all 30-min intervals
        List<LocalDateTime> intervals = generateIntervals(startDate, endDate);
        
        int occupiedCount = 0;
        int totalIntervalsWithData = 0;
        
        for (LocalDateTime intervalStart : intervals) {
            LocalDateTime intervalEnd = intervalStart.plusMinutes(INTERVAL_MINUTES);
            
            // Check if sensor sent data in this interval and if occupied
            Boolean hasDataAndOccupied = null;
            boolean hasAnyData = false;
            
            for (Map<String, Object> row : data) {
                try {
                    Object receivedAtObj = row.get("received_at");
                    if (receivedAtObj == null) continue;
                    
                    LocalDateTime timestamp;
                    if (receivedAtObj instanceof java.sql.Timestamp) {
                        timestamp = ((java.sql.Timestamp) receivedAtObj).toInstant().atZone(PARIS_ZONE).toLocalDateTime();
                    } else if (receivedAtObj instanceof LocalDateTime) {
                        timestamp = ZonedDateTime.of((LocalDateTime) receivedAtObj, UTC_ZONE).withZoneSameInstant(PARIS_ZONE).toLocalDateTime();
                    } else {
                        continue;
                    }
                    
                    // Check if timestamp is within interval [start, end)
                    if (timestamp.isBefore(intervalStart) || !timestamp.isBefore(intervalEnd)) {
                        continue;
                    }
                    
                    // This interval has data
                    hasAnyData = true;
                    
                    String value = (String) row.get("value");
                    if (value != null) {
                        try {
                            if (Integer.parseInt(value) > 0) {
                                hasDataAndOccupied = true;
                                break; // Found occupied data, no need to check more
                            }
                        } catch (NumberFormatException e) {
                            if ("occupied".equalsIgnoreCase(value) || "used".equalsIgnoreCase(value)) {
                                hasDataAndOccupied = true;
                                break;
                            }
                        }
                    }
                } catch (Exception e) {
                    // Ignore parsing errors
                }
            }
            
            // Only count intervals with data
            if (hasAnyData) {
                totalIntervalsWithData++;
                if (hasDataAndOccupied != null && hasDataAndOccupied) {
                    occupiedCount++;
                }
            }
        }
        
        Map<String, Integer> result = new HashMap<>();
        result.put("occupied", occupiedCount);
        result.put("total", totalIntervalsWithData);  // CHANGED: Only intervals with data
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
     * New logic: Daily=startDate, Weekly=startDate+7d, Monthly=startDate+30d
     */
    private OccupancyStats calculateGlobalStatsWithDates(String name, List<String> sensorIds, LocalDate customStart, LocalDate customEnd) {
        // If no custom dates provided, return empty stats
        if (customStart == null || customEnd == null) {
            return OccupancyStats.builder()
                    .sensorId("GLOBAL")
                    .sensorName(name)
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
        
        long daysBetween = ChronoUnit.DAYS.between(customStart, customEnd);
        
        // Daily: Start date only (1 day)
        Map<String, Integer> dailyStats = calculateGlobalOccupancyForPeriod(
                sensorIds, customStart, customStart.plusDays(1));
        
        // Weekly: Start date + 7 days (only if range >= 7 days)
        Map<String, Integer> weeklyStats = null;
        if (daysBetween >= 7) {
            LocalDate weekEnd = customStart.plusDays(7);
            if (weekEnd.isAfter(customEnd)) weekEnd = customEnd;
            weeklyStats = calculateGlobalOccupancyForPeriod(sensorIds, customStart, weekEnd.plusDays(1));
        }
        
        // Monthly: Start date + 30 days (only if range >= 30 days)
        Map<String, Integer> monthlyStats = null;
        if (daysBetween >= 30) {
            LocalDate monthEnd = customStart.plusDays(30);
            if (monthEnd.isAfter(customEnd)) monthEnd = customEnd;
            monthlyStats = calculateGlobalOccupancyForPeriod(sensorIds, customStart, monthEnd.plusDays(1));
        }

        return OccupancyStats.builder()
                .sensorId("GLOBAL")
                .sensorName(name)
                .dailyOccupancyRate(calculateRate(dailyStats))
                .dailyOccupiedIntervals(dailyStats.get("occupied"))
                .dailyTotalIntervals(dailyStats.get("total"))
                .weeklyOccupancyRate(weeklyStats != null ? calculateRate(weeklyStats) : 0.0)
                .weeklyOccupiedIntervals(weeklyStats != null ? weeklyStats.get("occupied") : 0)
                .weeklyTotalIntervals(weeklyStats != null ? weeklyStats.get("total") : 0)
                .monthlyOccupancyRate(monthlyStats != null ? calculateRate(monthlyStats) : 0.0)
                .monthlyOccupiedIntervals(monthlyStats != null ? monthlyStats.get("occupied") : 0)
                .monthlyTotalIntervals(monthlyStats != null ? monthlyStats.get("total") : 0)
                .build();
    }

    /**
     * Calculate occupancy for a single sensor over a period
     * NEW LOGIC: Total = number of intervals with data (not theoretical 16 intervals/day)
     */
    private Map<String, Integer> calculateOccupancyForPeriod(
            String sensorId, LocalDate startDate, LocalDate endDate) {
        
        int totalIntervalsWithData = 0;
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
                
                // Check if there's data in this interval
                Integer occupancyStatus = getIntervalOccupancyStatus(sensorId, intervalStart, intervalEnd);
                
                // Only count intervals where sensor sent data
                if (occupancyStatus != null) {
                    totalIntervalsWithData++;
                    if (occupancyStatus > 0) {
                        occupiedIntervals++;
                    }
                }
            }

            currentDate = currentDate.plusDays(1);
        }

        Map<String, Integer> result = new HashMap<>();
        result.put("occupied", occupiedIntervals);
        result.put("total", totalIntervalsWithData);  // CHANGED: Real data intervals, not 16
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
     * Get occupancy status for a 30-min interval
     * Returns: null if no data, 0 if free, >0 if occupied
     * 
     * For COUNT sensors: calculates (period_in - period_out). If = 0, room is empty; otherwise occupied
     */
    private Integer getIntervalOccupancyStatus(String sensorId, LocalDateTime start, LocalDateTime end) {
        try {
            // Convert Paris local interval bounds to UTC for querying the UTC stored received_at.
            LocalDateTime startUtc = ZonedDateTime.of(start, PARIS_ZONE).withZoneSameInstant(UTC_ZONE).toLocalDateTime();
            LocalDateTime endUtc = ZonedDateTime.of(end, PARIS_ZONE).withZoneSameInstant(UTC_ZONE).toLocalDateTime();

            // First, try COUNT sensor logic (period_in / period_out)
            if (sensorId.toLowerCase().startsWith("count")) {
                String countQuery = """
                    SELECT value_type, value FROM sensor_data 
                    WHERE id_sensor = ? 
                    AND value_type IN ('PERIOD_IN', 'PERIOD_OUT')
                    AND received_at >= ? 
                    AND received_at < ?
                    ORDER BY received_at
                    """;
                
                List<Map<String, Object>> countResults = jdbcTemplate.queryForList(
                        countQuery, sensorId, startUtc, endUtc);
                
                if (!countResults.isEmpty()) {
                    int periodIn = 0;
                    int periodOut = 0;
                    
                    for (Map<String, Object> row : countResults) {
                        String valueType = (String) row.get("value_type");
                        String value = (String) row.get("value");
                        
                        if (value != null) {
                            try {
                                int numValue = (int) Double.parseDouble(value);
                                if ("PERIOD_IN".equals(valueType)) {
                                    periodIn += numValue;
                                } else if ("PERIOD_OUT".equals(valueType)) {
                                    periodOut += numValue;
                                }
                            } catch (NumberFormatException e) {
                                // Ignore invalid values
                            }
                        }
                    }
                    
                    // Calculate occupancy: if (in - out) = 0, room is empty; otherwise occupied
                    int netOccupancy = periodIn - periodOut;
                    return (netOccupancy == 0) ? 0 : 1;
                }
            }
            
            // Standard OCCUPANCY sensor logic
            String query = """
                SELECT value FROM sensor_data 
                WHERE id_sensor = ? 
                AND value_type = 'OCCUPANCY'
                AND received_at >= ? 
                AND received_at < ?
                ORDER BY received_at
                """;
            
            List<Map<String, Object>> results = jdbcTemplate.queryForList(
                    query, sensorId, startUtc, endUtc);
            
            // No data in this interval
            if (results.isEmpty()) {
                return null;
            }
            
            // Check if any value shows occupied (>0)
            for (Map<String, Object> row : results) {
                String value = (String) row.get("value");
                if (value != null) {
                    try {
                        int occupancyValue = Integer.parseInt(value);
                        if (occupancyValue > 0) {
                            return 1; // Occupied
                        }
                    } catch (NumberFormatException e) {
                        // Check string values
                        if ("occupied".equalsIgnoreCase(value) || "used".equalsIgnoreCase(value)) {
                            return 1; // Occupied
                        }
                    }
                }
            }
            
            // Has data but all values are 0 (free)
            return 0;
        } catch (Exception e) {
            log.error("Error checking interval occupancy for sensor {}: {}", sensorId, e.getMessage());
            return null;
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
     * Format sensor name for display with explicit mappings
     */
    private String formatSensorName(String sensorId) {
        // Desk section
        if (sensorId.startsWith("desk-03-")) {
            return "Desk " + sensorId.substring(8);
        }
        
        // Salle de Réunion (Meeting Room) - SR01, SR02, SR03
        if (sensorId.equals("occup-vs70-03-01")) return "SR01";
        if (sensorId.equals("occup-vs70-03-02")) return "SR02";
        if (sensorId.equals("count-03-01")) return "SR03";
        
        // Phone Booth - PB1 to PB7 (explicit mapping)
        if (sensorId.equals("desk-vs41-03-03")) return "PB1";
        if (sensorId.equals("desk-vs41-03-04")) return "PB2";
        if (sensorId.equals("occup-vs30-03-01")) return "PB3";
        if (sensorId.equals("occup-vs30-03-02")) return "PB4";
        if (sensorId.equals("desk-vs40-03-01")) return "PB5";
        if (sensorId.equals("occup-vs70-03-03")) return "PB6";
        if (sensorId.equals("occup-vs70-03-04")) return "PB7";
        
        // Interview Room - IR01, IR02
        if (sensorId.equals("desk-vs41-03-01")) return "IR01";
        if (sensorId.equals("desk-vs41-03-02")) return "IR02";
        
        // Fallback to original ID
        return sensorId;
    }

    /**
     * NEW METHOD: Get daily occupancy data for a section
     * Returns data day-by-day (excluding weekends) for each sensor
     */
    public SectionDailyOccupancyResponse getSectionDailyOccupancy(String sectionType, String startDateStr, String endDateStr) {
        List<String> sensorIds = getSensorIdsBySection(sectionType);
        String sectionName = getSectionName(sectionType);
        
        log.info("📊 Calculating DAILY occupancy for section: {} with {} sensors (dates: {} to {})", 
                sectionName, sensorIds.size(), startDateStr, endDateStr);

        // Parse dates
        LocalDate startDate = LocalDate.parse(startDateStr);
        LocalDate endDate = LocalDate.parse(endDateStr);
        
        // Generate list of working days (Mon-Fri only)
        List<LocalDate> workingDays = generateWorkingDays(startDate, endDate);
        log.info("📅 Working days in range: {}", workingDays.size());
        
        // Azure MySQL stores received_at in UTC; fetch a full-day UTC range to avoid timezone edge issues.
        LocalDateTime startDateTime = startDate.atStartOfDay();
        LocalDateTime endDateTime = endDate.plusDays(1).atStartOfDay();
        
        String inClause = sensorIds.stream()
                .map(id -> "?")
                .collect(Collectors.joining(","));
        
        String query = String.format("""
            SELECT id_sensor, received_at, value, value_type 
            FROM sensor_data 
            WHERE id_sensor IN (%s)
            AND value_type IN ('OCCUPANCY', 'PERIOD_IN', 'PERIOD_OUT')
            AND received_at >= ? 
            AND received_at < ?
            ORDER BY id_sensor, received_at
            """, inClause);
        
        Object[] params = new Object[sensorIds.size() + 2];
        for (int i = 0; i < sensorIds.size(); i++) {
            params[i] = sensorIds.get(i);
        }
        params[sensorIds.size()] = startDateTime;
        params[sensorIds.size() + 1] = endDateTime;
        
        List<Map<String, Object>> allData = jdbcTemplate.queryForList(query, params);
        log.info("✅ Fetched {} rows for {} sensors", allData.size(), sensorIds.size());
        
        // Group data by sensor
        Map<String, List<Map<String, Object>>> dataPerSensor = allData.stream()
                .collect(Collectors.groupingBy(row -> (String) row.get("id_sensor")));
        
        // Process each sensor
        List<SensorDailyStats> allSensorStats = new ArrayList<>();
        int totalIntervalsGlobal = 0;
        int totalOccupiedGlobal = 0;
        
        for (String sensorId : sensorIds) {
            List<Map<String, Object>> sensorData = dataPerSensor.getOrDefault(sensorId, new ArrayList<>());
            
            // Calculate daily stats for each working day
            List<DailyOccupancyData> dailyDataList = new ArrayList<>();
            int sensorTotalIntervals = 0;
            int sensorOccupiedIntervals = 0;
            
            for (LocalDate day : workingDays) {
                Map<String, Integer> dayStats = calculateStatsFromDataForSingleDay(sensorData, day);
                
                double dayRate = dayStats.get("total") > 0 
                        ? (dayStats.get("occupied") * 100.0 / dayStats.get("total")) 
                        : 0.0;
                
                dailyDataList.add(DailyOccupancyData.builder()
                        .date(day)
                        .occupiedIntervals(dayStats.get("occupied"))
                        .totalIntervals(dayStats.get("total"))
                        .occupancyRate(dayRate)
                        .build());
                
                sensorTotalIntervals += dayStats.get("total");
                sensorOccupiedIntervals += dayStats.get("occupied");
            }
            
            // Calculate overall rate for this sensor across entire period
            double overallRate = sensorTotalIntervals > 0 
                    ? (sensorOccupiedIntervals * 100.0 / sensorTotalIntervals) 
                    : 0.0;
            
            allSensorStats.add(SensorDailyStats.builder()
                    .sensorId(sensorId)
                    .sensorName(formatSensorName(sensorId))
                    .dailyData(dailyDataList)
                    .overallOccupancyRate(overallRate)
                    .build());
            
            totalIntervalsGlobal += sensorTotalIntervals;
            totalOccupiedGlobal += sensorOccupiedIntervals;
        }
        
        // Calculate global occupancy rate (all sensors, all days)
        double globalRate = totalIntervalsGlobal > 0 
                ? (totalOccupiedGlobal * 100.0 / totalIntervalsGlobal) 
                : 0.0;
        
        log.info("✅ Global occupancy rate: {:.2f}% ({}/{} intervals)", globalRate, totalOccupiedGlobal, totalIntervalsGlobal);
        
        return SectionDailyOccupancyResponse.builder()
                .sectionName(sectionName)
                .totalSensors(sensorIds.size())
                .globalOccupancyRate(globalRate)
                .dateRange(workingDays)
                .sensorStats(allSensorStats)
                .calculationMethod("Taux = (Intervalles Occupés / Intervalles avec Données) × 100")
                .businessHours("9h00-12h30 et 14h00-18h30")
                .workingDays("Lundi à Vendredi (weekends exclus)")
                .build();
    }

    /**
     * Generate list of working days (Monday-Friday) between start and end date
     */
    private List<LocalDate> generateWorkingDays(LocalDate start, LocalDate end) {
        List<LocalDate> workingDays = new ArrayList<>();
        LocalDate current = start;
        
        while (!current.isAfter(end)) {
            if (current.getDayOfWeek() != DayOfWeek.SATURDAY && 
                current.getDayOfWeek() != DayOfWeek.SUNDAY) {
                workingDays.add(current);
            }
            current = current.plusDays(1);
        }
        
        return workingDays;
    }

    /**
     * Calculate occupancy stats for a single day from in-memory data
     */
    private Map<String, Integer> calculateStatsFromDataForSingleDay(List<Map<String, Object>> data, LocalDate day) {
        List<LocalDateTime> intervals = generateBusinessHoursIntervals(day);
        
        int occupiedCount = 0;
        int totalIntervalsWithData = 0;
        
        for (LocalDateTime intervalStart : intervals) {
            LocalDateTime intervalEnd = intervalStart.plusMinutes(INTERVAL_MINUTES);
            
            boolean hasAnyData = false;
            boolean isOccupied = false;
            
            for (Map<String, Object> row : data) {
                try {
                    Object receivedAtObj = row.get("received_at");
                    if (receivedAtObj == null) continue;
                    
                    LocalDateTime timestamp;
                    if (receivedAtObj instanceof java.sql.Timestamp) {
                        timestamp = ((java.sql.Timestamp) receivedAtObj).toInstant().atZone(PARIS_ZONE).toLocalDateTime();
                    } else if (receivedAtObj instanceof LocalDateTime) {
                        timestamp = ZonedDateTime.of((LocalDateTime) receivedAtObj, UTC_ZONE).withZoneSameInstant(PARIS_ZONE).toLocalDateTime();
                    } else {
                        continue;
                    }
                    
                    // Check if timestamp is within interval [start, end)
                    if (timestamp.isBefore(intervalStart) || !timestamp.isBefore(intervalEnd)) {
                        continue;
                    }
                    
                    hasAnyData = true;
                    
                    String value = (String) row.get("value");
                    if (value != null) {
                        try {
                            if (Integer.parseInt(value) > 0) {
                                isOccupied = true;
                                break;
                            }
                        } catch (NumberFormatException e) {
                            if ("occupied".equalsIgnoreCase(value) || "used".equalsIgnoreCase(value)) {
                                isOccupied = true;
                                break;
                            }
                        }
                    }
                } catch (Exception e) {
                    // Ignore parsing errors
                }
            }
            
            if (hasAnyData) {
                totalIntervalsWithData++;
                if (isOccupied) {
                    occupiedCount++;
                }
            }
        }
        
        Map<String, Integer> result = new HashMap<>();
        result.put("occupied", occupiedCount);
        result.put("total", totalIntervalsWithData);
        return result;
    }
}
