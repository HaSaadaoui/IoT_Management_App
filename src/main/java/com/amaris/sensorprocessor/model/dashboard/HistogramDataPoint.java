package com.amaris.sensorprocessor.model.dashboard;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents a single data point in a histogram.
 * Each point represents an aggregated value for a specific time bucket (hour or day).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class HistogramDataPoint {

    private String timestamp;        // Time bucket: "2025-12-03" (daily) or "2025-12-03 14:00:00" (hourly)
    private Double value;            // Aggregated value (average, sum, max, min)
    private Integer sensorCount;     // Number of sensors that contributed to this point
    private Integer dataPointCount;  // Number of raw data points aggregated
}
