package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.model.dashboard.DashboardData;

import com.amaris.sensorprocessor.model.dashboard.Desk;

import java.util.List;
import java.util.Optional;

public interface DashboardService {
    DashboardData getDashboardData(String year, String month, String building, String floor, String sensorType, String timeSlot);
    List<Desk> getDesksByFloor(String floor, Optional<String> deskId);
}
