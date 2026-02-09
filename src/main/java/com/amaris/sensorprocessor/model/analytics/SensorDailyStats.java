package com.amaris.sensorprocessor.model.analytics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Daily statistics for a single sensor across multiple days
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SensorDailyStats {
    private String sensorId;
    private String sensorName;
    private List<DailyOccupancyData> dailyData;
    private double overallOccupancyRate;  // Average rate for entire period
}
