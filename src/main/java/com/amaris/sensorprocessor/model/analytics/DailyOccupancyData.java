package com.amaris.sensorprocessor.model.analytics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Daily occupancy data for a single sensor on a specific date
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DailyOccupancyData {
    private LocalDate date;
    private int occupiedIntervals;
    private int totalIntervals;
    private double occupancyRate;
}
