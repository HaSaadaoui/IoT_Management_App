package com.amaris.sensorprocessor.model.analytics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

/**
 * Response containing daily occupancy data for all sensors in a section
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SectionDailyOccupancyResponse {
    private String sectionName;
    private int totalSensors;
    private double globalOccupancyRate;  // Average rate across all sensors for entire period
    private List<LocalDate> dateRange;   // List of dates in the period (excluding weekends)
    private List<SensorDailyStats> sensorStats;
    private String calculationMethod;
    private String businessHours;
    private String workingDays;
}
