package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.amaris.sensorprocessor.entity.User;
import com.amaris.sensorprocessor.model.dashboard.*;
import com.amaris.sensorprocessor.service.DashboardService;
import com.amaris.sensorprocessor.service.UserService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.security.Principal;
import java.util.Date;
import java.util.List;
import java.util.Optional;

@Slf4j
@Controller
public class DashboardController {

    private final UserService userService;
    private final DashboardService dashboardService;

    @Autowired
    public DashboardController(UserService userService, DashboardService dashboardService) {
        this.userService = userService;
        this.dashboardService = dashboardService;
    }

    @GetMapping("/dashboard")
    public String dashboard(Model model, Principal principal) {
        User user = userService.searchUserByUsername(principal.getName());
        model.addAttribute("user", user);
        model.addAttribute("loggedUsername", user.getUsername());
        return "dashboard";
    }

    @GetMapping("/api/dashboard")
    @ResponseBody
    public DashboardData getDashboardData(
            @RequestParam(required = false) String year,
            @RequestParam(required = false) String month,
            @RequestParam(required = false) String building,
            @RequestParam(required = false) String floor,
            @RequestParam(required = false) String sensorType,
            @RequestParam(required = false) String timeSlot) {
        return dashboardService.getDashboardData(year, month, building, floor, sensorType, timeSlot);
    }

    @GetMapping("/api/dashboard/occupancy")
    @ResponseBody
    public List<Desk> getOccupancy(@RequestParam String floor, @RequestParam(required = false) String deskId) {
        var desks = dashboardService.getDesksByFloor(floor, Optional.ofNullable(deskId));
        return desks;
    }

    @GetMapping("/api/dashboard/sensors")
    @ResponseBody
    public List<SensorInfo> getSensors(
            @RequestParam(required = false) String building,
            @RequestParam(required = false) String floor,
            @RequestParam(required = false) String sensorType) {
        return dashboardService.getSensorsList(building, floor, sensorType);
    }

    @GetMapping("/api/dashboard/occupation-history")
    @ResponseBody
    public List<OccupationHistoryEntry> getOccupationHistory(
            @RequestParam(required = false) List<String> sensorIds,
            @RequestParam(required = false) Integer days) {
        return dashboardService.getOccupationHistory(sensorIds, days != null ? days : 30);
    }

    @GetMapping("/api/dashboard/histogram")
    @ResponseBody
    public HistogramResponse getHistogram(
            @RequestParam(required = false) String building,
            @RequestParam(required = false) String floor,
            @RequestParam(required = false) String sensorType,
            @RequestParam(required = false) String sensorId,
            @RequestParam(required = false) String metricType,
            @RequestParam(required = false) String timeRange,
            @RequestParam(required = false) String granularity,
            @RequestParam(required = false) String timeSlot,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") Date customStartDate,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") Date customEndDate) {

        // Build histogram request
        HistogramRequest request = HistogramRequest.builder()
                .building(building)
                .floor(floor)
                .sensorType(sensorType)
                .sensorId(sensorId)
                .metricType(metricType != null ? PayloadValueType.valueOf(metricType) : null)
                .timeRange(timeRange != null ? HistogramRequest.TimeRangePreset.valueOf(timeRange) : null)
                .granularity(granularity != null ? HistogramRequest.Granularity.valueOf(granularity) : null)
                .timeSlot(timeSlot != null ? HistogramRequest.TimeSlot.valueOf(timeSlot) : null)
                .customStartDate(customStartDate)
                .customEndDate(customEndDate)
                .build();

        return dashboardService.getHistogramData(request);
    }

}
