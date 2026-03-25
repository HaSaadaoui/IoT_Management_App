package com.amaris.sensorprocessor.model.dashboard;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OccupationHistoryEntry {
    private String date;
    private double occupancyRate;
    private int totalReadings;
    private int occupiedReadings;
}
