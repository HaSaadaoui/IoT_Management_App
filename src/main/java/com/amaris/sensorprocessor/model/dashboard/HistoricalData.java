package com.amaris.sensorprocessor.model.dashboard;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class HistoricalData {
    private double globalOccupancy;
    private int totalSensors;
    private int activeSensors;
    private List<DataPoint> dataPoints;
}
