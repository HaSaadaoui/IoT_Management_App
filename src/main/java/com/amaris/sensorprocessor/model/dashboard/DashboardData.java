package com.amaris.sensorprocessor.model.dashboard;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class DashboardData {
    private List<Alert> alerts;
    private List<LiveSensorData> liveSensorData;
    private HistoricalData historicalData;
}
