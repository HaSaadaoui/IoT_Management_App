package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.model.dashboard.DashboardData;
import com.amaris.sensorprocessor.model.dashboard.Desk;
import com.amaris.sensorprocessor.model.dashboard.HistogramRequest;
import com.amaris.sensorprocessor.model.dashboard.HistogramResponse;
import com.amaris.sensorprocessor.model.dashboard.OccupationHistoryEntry;
import com.amaris.sensorprocessor.model.dashboard.SensorInfo;

import java.util.List;
import java.util.Optional;

public interface DashboardService {
    DashboardData getDashboardData(String year, String month, String building, String floor, String sensorType, String timeSlot);
    List<Desk> getDesks(String building, String floor, Optional<String> deskId);
    List<SensorInfo> getSensorsList(String building, String floor, String sensorType);
    List<OccupationHistoryEntry> getOccupationHistory(List<String> sensorIds, int days);
    HistogramResponse getHistogramData(HistogramRequest request);
}
