package com.amaris.sensorprocessor.model.dashboard;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@AllArgsConstructor
public class HistoricalData {
    private double globalOccupation;
    private List<Map<String, String>> dailyHistory;
}
