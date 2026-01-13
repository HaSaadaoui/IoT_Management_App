package com.amaris.sensorprocessor.model.dashboard;

import com.amaris.sensorprocessor.entity.PayloadValueType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * Request model for histogram data.
 * Used to specify filters and configuration for histogram generation.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HistogramRequest {

    // Filters
    private String building;        // Building filter (e.g., "Mantu", "all")
    private String floor;           // Floor filter (e.g., "1", "all")
    private String sensorType;      // Sensor type (e.g., "DESK", "TEMPERATURE")
    private String sensorId;        // Specific sensor ID (optional, for single sensor queries)

    // Histogram Configuration
    private PayloadValueType metricType;  // Metric to display (e.g., OCCUPANCY, TEMPERATURE)
    private TimeRangePreset timeRange;    // Time range preset
    private Granularity granularity;      // Daily or hourly granularity
    private TimeSlot timeSlot;            // Time slot filter (morning, afternoon, evening, all)

    // Custom date range (optional, for CUSTOM timeRange)
    private Date customStartDate;
    private Date customEndDate;

    private String excludeSensorType;


    /**
     * Time range presets for histogram.
     */
    public enum TimeRangePreset {
        TODAY,
        LAST_7_DAYS,
        LAST_30_DAYS,
        THIS_MONTH,
        LAST_MONTH,
        CUSTOM
    }

    /**
     * Granularity for histogram binning.
     */
    public enum Granularity {
        DAILY,
        HOURLY
    }

    /**
     * Time slot filter for hourly data.
     */
    public enum TimeSlot {
        ALL,
        MORNING,      // 6:00 - 12:00
        AFTERNOON,    // 12:00 - 18:00
        EVENING;      // 18:00 - 24:00

        /**
         * Check if an hour falls within this time slot.
         */
        public boolean isInTimeSlot(int hour) {
            return switch (this) {
                case ALL -> true;
                case MORNING -> hour >= 6 && hour < 12;
                case AFTERNOON -> hour >= 12 && hour < 18;
                case EVENING -> hour >= 18 && hour < 24;
            };
        }
    }
}
