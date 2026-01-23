package com.amaris.sensorprocessor.model.analytics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OccupancyStats {
    private String sensorId;
    private String sensorName;
    
    // Daily stats
    private double dailyOccupancyRate;
    private int dailyOccupiedIntervals;
    private int dailyTotalIntervals;
    
    // Weekly stats
    private double weeklyOccupancyRate;
    private int weeklyOccupiedIntervals;
    private int weeklyTotalIntervals;
    
    // Monthly stats
    private double monthlyOccupancyRate;
    private int monthlyOccupiedIntervals;
    private int monthlyTotalIntervals;
}
