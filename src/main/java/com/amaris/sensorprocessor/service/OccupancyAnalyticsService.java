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
    public SectionOccupancyResponse getSectionOccupancy(String sectionType) {
        List<String> sensorIds = getSensorIdsBySection(sectionType);
        String sectionName = getSectionName(sectionType);
        
        log.info("Calculating occupancy for section: {} with {} sensors", sectionName, sensorIds.size());

        // Calculate stats for each sensor
        List<OccupancyStats> sensorStats = sensorIds.stream()
                .map(this::calculateSensorOccupancy)
                .collect(Collectors.toList());

        // Calculate global stats for the section
        OccupancyStats globalStats = calculateGlobalStats(sectionName + " - Global", sensorIds);

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
     * Calculate occupancy stats for a single sensor
     */
    private OccupancyStats calculateSensorOccupancy(String sensorId) {
        LocalDate today = LocalDate.now();
        
        // Get first day of current week (Monday)
        LocalDate weekStart = today.with(DayOfWeek.MONDAY);
        
        // Get first day of current month
        LocalDate monthStart = today.with(TemporalAdjusters.firstDayOfMonth());

        // Calculate daily occupancy
        Map<String, Integer> dailyStats = calculateOccupancyForPeriod(
                sensorId, today, today.plusDays(1));
        
        // Calculate weekly occupancy
        Map<String, Integer> weeklyStats = calculateOccupancyForPeriod(
                sensorId, weekStart, today.plusDays(1));
        
        // Calculate monthly occupancy
        Map<String, Integer> monthlyStats = calculateOccupancyForPeriod(
                sensorId, monthStart, today.plusDays(1));

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
     * Calculate global stats for all sensors in a section
     */
    private OccupancyStats calculateGlobalStats(String name, List<String> sensorIds) {
        LocalDate today = LocalDate.now();
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
