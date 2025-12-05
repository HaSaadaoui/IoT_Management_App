package com.amaris.sensorprocessor.model.dashboard;

import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Response model for histogram data.
 * Contains aggregated data points and summary statistics.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class HistogramResponse {

    private PayloadValueType metricType;        // The metric type displayed
    private String granularity;                 // "DAILY" or "HOURLY"
    private String timeRange;                   // "LAST_7_DAYS", "LAST_30_DAYS", etc.
    private AggregationType aggregationType;    // How the data was aggregated

    private List<HistogramDataPoint> dataPoints;  // The histogram data points
    private HistogramSummary summary;             // Summary statistics

    /**
     * Type of aggregation applied to the data.
     */
    public enum AggregationType {
        AVERAGE,  // Average value
        SUM,      // Sum of values
        MAX,      // Maximum value
        MIN       // Minimum value
    }
}
