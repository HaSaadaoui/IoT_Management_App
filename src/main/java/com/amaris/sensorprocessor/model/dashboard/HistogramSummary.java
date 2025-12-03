package com.amaris.sensorprocessor.model.dashboard;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Summary statistics for histogram data.
 * Provides overview of the histogram dataset.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class HistogramSummary {

    private Integer totalSensors;      // Total number of sensors in the dataset
    private Integer activeSensors;     // Number of sensors with data in the period
    private Double minValue;           // Minimum value across all data points
    private Double maxValue;           // Maximum value across all data points
    private Double avgValue;           // Average value across all data points
    private TimePeriod period;         // Time period covered by the histogram

    /**
     * Time period information.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TimePeriod {
        private LocalDateTime start;   // Start of the period
        private LocalDateTime end;     // End of the period
    }
}
