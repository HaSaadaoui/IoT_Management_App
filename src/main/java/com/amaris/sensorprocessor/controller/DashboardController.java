package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.amaris.sensorprocessor.entity.User;
import com.amaris.sensorprocessor.model.dashboard.Alert;
import com.amaris.sensorprocessor.model.dashboard.*;
import com.amaris.sensorprocessor.service.AlertService;
import com.amaris.sensorprocessor.service.DashboardService;
import com.amaris.sensorprocessor.service.UserService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import com.amaris.sensorprocessor.service.SensorService;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;

import java.time.Duration;



@Slf4j
@Controller
public class DashboardController {

    private final SensorService sensorService;
    private final UserService userService;
    private final DashboardService dashboardService;
    private final AlertService alertService;

    @Autowired
    public DashboardController(UserService userService, DashboardService dashboardService, AlertService alertService, SensorService sensorService) {
        this.userService = userService;
        this.dashboardService = dashboardService;
        this.alertService = alertService;
        this.sensorService = sensorService;
    }

    @GetMapping("/dashboard")
    public String dashboard(Model model, Principal principal) {
        User user = userService.searchUserByUsername(principal.getName());
        model.addAttribute("user", user);
        model.addAttribute("loggedUsername", user.getUsername());
        return "dashboard";
    }

    @GetMapping("/api/alerts")
    @ResponseBody
    public List<Alert> getAlerts() {
        return alertService.getCurrentAlerts();
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
    public List<Desk> getOccupancy(
            @RequestParam(required = false) String building,
            @RequestParam(required = false) String floor,
            @RequestParam(required = false) String deskId
    ) {
        return dashboardService.getDesks(building, floor, Optional.ofNullable(deskId));
    }

    @GetMapping(value = "/api/dashboard/occupancy/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @ResponseBody
    public Flux<ServerSentEvent<String>> streamOccupancy(
            @RequestParam(required = false) String building,
            @RequestParam(required = false) String floor,
            @RequestParam(required = false, defaultValue = "ui") String clientId
    ) {
        final String appId = mapBuildingToAppId(building);

        Flux<String> upstream = sensorService.getMonitoringMany(appId, List.of(), clientId);
        Flux<ServerSentEvent<String>> keepAlive =
                Flux.interval(Duration.ofSeconds(15))
                        .map(t -> ServerSentEvent.builder("ping").event("keepalive").build());

        return upstream
                .filter(s -> s != null && !s.isBlank())
                .map(payload -> ServerSentEvent.builder(payload).event("uplink").build())
                .mergeWith(keepAlive);
    }

    private String mapBuildingToAppId(String building) {
        if (building == null || building.isBlank() || "all".equalsIgnoreCase(building)) {
            return "rpi-mantu-appli"; // default
        }
        return switch (building.trim().toUpperCase()) {
            case "CHATEAUDUN", "CHÂTEAUDUN" -> "rpi-mantu-appli";
            case "LEVALLOIS" -> "lorawan-network-mantu";
            case "LILLE" -> "lil-rpi-mantu-appli";
            default -> building;
        };
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
            @RequestParam(required = false) String excludeSensorType,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") Date customStartDate,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") Date customEndDate) {

        HistogramRequest request = HistogramRequest.builder()
                .building(building)
                .floor(floor)
                .sensorType(sensorType)
                .sensorId(sensorId)
                .metricType(parseMetricType(metricType)) // ✅ ici
                .timeRange(timeRange != null ? HistogramRequest.TimeRangePreset.valueOf(timeRange) : null)
                .granularity(granularity != null ? HistogramRequest.Granularity.valueOf(granularity) : null)
                .timeSlot(timeSlot != null ? HistogramRequest.TimeSlot.valueOf(timeSlot) : null)
                .excludeSensorType(excludeSensorType)
                .customStartDate(customStartDate)
                .customEndDate(customEndDate)
                .build();

        return dashboardService.getHistogramData(request);
    }

    /**
     * Parse robuste de metricType + alias éventuels.
     * - évite les 500 (No enum constant)
     * - permet d'introduire POWER_TOTAL / ENERGY_TOTAL proprement
     */
    private PayloadValueType parseMetricType(String metricType) {
        if (metricType == null || metricType.isBlank()) return null;

        final String mt = metricType.trim().toUpperCase();

        try {
            return PayloadValueType.valueOf(mt);
        } catch (IllegalArgumentException e) {
            // IMPORTANT: renvoyer 400 au lieu de 500
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Unknown metricType: " + metricType
            );
        }
    }


    @GetMapping(
            value = "/api/dashboard/live/stream",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    @ResponseBody
    public Flux<ServerSentEvent<String>> streamLiveData(
            @RequestParam String building,
            @RequestParam(defaultValue = "ui") String clientId,
            @RequestParam(required = false) String deviceIds
    ) {
        final String appId = mapBuildingToAppId(building);

        List<String> ids =
                deviceIds == null || deviceIds.isBlank()
                        ? List.of()
                        : Arrays.asList(deviceIds.split(","));

        return sensorService
                .getMonitoringMany(appId, ids, clientId)
                .filter(s -> s != null && !s.isBlank())
                .map(payload ->
                        ServerSentEvent.builder(payload)
                                .event("uplink")
                                .build()
                )
                .mergeWith(
                        Flux.interval(Duration.ofSeconds(15))
                                .map(t -> ServerSentEvent.builder("ping")
                                        .event("keepalive")
                                        .build())
                );
    }

}
