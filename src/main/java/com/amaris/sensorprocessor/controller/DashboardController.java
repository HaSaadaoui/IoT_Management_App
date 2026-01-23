package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.amaris.sensorprocessor.entity.Sensor;
import com.amaris.sensorprocessor.entity.User;
import reactor.core.scheduler.Schedulers;

import com.amaris.sensorprocessor.model.dashboard.Alert;
import com.amaris.sensorprocessor.model.dashboard.*;
import com.amaris.sensorprocessor.repository.SensorDao;
import com.amaris.sensorprocessor.service.AlertService;
import com.amaris.sensorprocessor.service.DashboardService;
import com.amaris.sensorprocessor.service.UserService;
import com.amaris.sensorprocessor.repository.SensorDataDao;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;

import com.amaris.sensorprocessor.service.SensorService;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;


@Slf4j
@Controller
public class DashboardController {

    private final SensorService sensorService;
    private final UserService userService;
    private final DashboardService dashboardService;
    private final AlertService alertService;
    private final ObjectMapper om = new ObjectMapper();
    private final SensorDataDao sensorDataDao;

    // POWER (W) : building -> device -> channel(0..11) -> lastW
    private final Map<String, Map<String, Map<Integer, Double>>> powerW =
            new java.util.concurrent.ConcurrentHashMap<>();

    // ENERGY index (Wh) current : building -> device -> channel -> currentWh
    private final Map<String, Map<String, Map<Integer, Double>>> energyWhCurrent =
            new java.util.concurrent.ConcurrentHashMap<>();

    // ENERGY index (Wh) min-of-day : building -> device -> channel -> minWh (depuis minuit)
    private final Map<String, Map<String, Map<Integer, Double>>> energyWhMinToday =
            new java.util.concurrent.ConcurrentHashMap<>();

    // Pour reset quotidien
    private final Map<String, java.time.LocalDate> lastDaySeen =
            new java.util.concurrent.ConcurrentHashMap<>();

    @Autowired
    public DashboardController(UserService userService, DashboardService dashboardService, AlertService alertService, SensorService sensorService, SensorDataDao sensorDataDao) {
        this.userService = userService;
        this.dashboardService = dashboardService;
        this.alertService = alertService;
        this.sensorService = sensorService;
        this.sensorDataDao = sensorDataDao;
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
        return alertService.getCurrentAlerts("");
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

    private static LocalDateTime parisStartOfDay() {
        return java.time.ZonedDateTime.now(java.time.ZoneId.of("Europe/Paris"))
                .toLocalDate()
                .atStartOfDay();
    }


    @GetMapping(value = "/api/dashboard/occupancy/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @ResponseBody
    public Flux<ServerSentEvent<String>> streamOccupancy(
            @RequestParam(required = false) String building,
            @RequestParam(required = false) String floor
    ) {
        final String appId = mapBuildingToAppId(building);

        Flux<String> upstream = sensorService.getMonitoringMany(appId, List.of());
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

    @GetMapping(value="/api/dashboard/conso/live/aggregate/stream", produces=MediaType.TEXT_EVENT_STREAM_VALUE)
    @ResponseBody
    public Flux<ServerSentEvent<ConsoLiveAggregate>> streamConsoAggregate(@RequestParam String building) {
        final String appId = mapBuildingToAppId(building);

        List<SensorInfo> sensors = dashboardService.getSensorsList(building, null, "CONSO");
        List<String> consoDeviceIds = sensors.stream()
                .map(SensorInfo::getIdSensor)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .filter(id -> id.toLowerCase().startsWith("cons"))
                .distinct()
                .toList();

        if (consoDeviceIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "No conso device found for building=" + building);
        }

        powerW.computeIfAbsent(building, k -> new ConcurrentHashMap<>());
        energyWhCurrent.computeIfAbsent(building, k -> new ConcurrentHashMap<>());
        energyWhMinToday.computeIfAbsent(building, k -> new ConcurrentHashMap<>());

        Mono<ServerSentEvent<ConsoLiveAggregate>> initial = Mono.fromCallable(() -> {
                    resetIfNewDay(building);
                    preloadEnergyBaselineFromDb(building, consoDeviceIds);
                    ConsoLiveAggregate dto = computeAggregate(building);
                    return ServerSentEvent.<ConsoLiveAggregate>builder(dto).event("conso_aggregate").build();
                })
                .subscribeOn(Schedulers.boundedElastic())
                .onErrorResume(e -> Mono.empty());

        // ✅ 2) live
        Flux<ServerSentEvent<ConsoLiveAggregate>> live = sensorService.getMonitoringMany(appId, consoDeviceIds)
                .filter(s -> s != null && !s.isBlank())
                .flatMap(json -> {
                    try {
                        resetIfNewDay(building);

                        ParsedUplink p = parseUplink(json);
                        if (p == null || p.deviceId == null || p.decodedPayload == null) {
                            return Mono.empty();
                        }

                        applyDecodedPayload(building, p.deviceId, p.decodedPayload);

                        ConsoLiveAggregate dto = computeAggregate(building);

                        return Mono.just(ServerSentEvent.<ConsoLiveAggregate>builder(dto)
                                .event("conso_aggregate")
                                .build());
                    } catch (Exception e) {
                        return Mono.empty();
                    }
                });

        // ✅ 3) keepalive avec data (sinon certains front ignorent)
        Flux<ServerSentEvent<ConsoLiveAggregate>> keepAlive =
                Flux.interval(Duration.ofSeconds(15))
                        .map(t -> ServerSentEvent.<ConsoLiveAggregate>builder()
                                .event("keepalive")
                                .data(new ConsoLiveAggregate(building, 0, 0, 0, 0, 0, System.currentTimeMillis()))
                                .build());

        return Flux.concat(initial, live).mergeWith(keepAlive);
    }


    private double computeTodayEnergyWh(String building) {
        double[] d = new double[12];

        var curByDev  = energyWhCurrent.getOrDefault(building, Map.of());
        var baseByDev = energyWhMinToday.getOrDefault(building, Map.of());

        for (var dev : curByDev.keySet()) {
            var curMap  = curByDev.getOrDefault(dev, Map.of());
            var baseMap = baseByDev.getOrDefault(dev, Map.of());

            for (int ch = 0; ch <= 11; ch++) {
                Double cur  = curMap.get(ch);
                Double base = baseMap.get(ch);
                if (cur == null || base == null) continue;

                double delta = cur - base;

                // si reset/rollover : index repasse en dessous
                if (delta < 0) delta = cur;

                d[ch] += delta;
            }
        }

        double[] ea = new double[12];
        for (int i = 0; i < 12; i++) ea[i] = Math.abs(d[i]);

        double redWh   = ea[0] + ea[1] + ea[2];
        double whiteWh = Math.abs((ea[6] + ea[7] + ea[8]) - (ea[3] + ea[4] + ea[5]));
        double ventWh  = ea[6] + ea[7] + ea[8];
        double otherWh = ea[9] + ea[10] + ea[11];

        return Math.abs(redWh + whiteWh + ventWh + otherWh);
    }

    @GetMapping("/api/dashboard/sensors")
    @ResponseBody
    public List<SensorInfo> getSensors(
            @RequestParam(required = false) String building,
            @RequestParam(required = false) String floor,
            @RequestParam(required = false) String sensorType) {
        return dashboardService.getSensorsList(building, floor, sensorType);
    }

    private void preloadEnergyBaselineFromDb(String building, List<String> deviceIds) {
        var baseByDev = energyWhMinToday.computeIfAbsent(building, k -> new java.util.concurrent.ConcurrentHashMap<>());

        LocalDateTime dayStart = parisStartOfDay();
        LocalDateTime dayEnd = dayStart.plusDays(1);

        Set<PayloadValueType> energyTypes = new HashSet<>();
        for (int ch = 0; ch <= 11; ch++) {
            energyTypes.add(PayloadValueType.valueOf("ENERGY_CHANNEL_" + ch));
        }

        for (String dev : deviceIds) {
            baseByDev.computeIfAbsent(dev, k -> new java.util.concurrent.ConcurrentHashMap<>());

            Map<PayloadValueType, Double> firsts =
                    sensorDataDao.findFirstValuesOfDayByTypes(dev, energyTypes, dayStart, dayEnd);

            for (int ch = 0; ch <= 11; ch++) {
                PayloadValueType vt = PayloadValueType.valueOf("ENERGY_CHANNEL_" + ch);
                Double v = firsts.get(vt);
                if (v != null) {
                    baseByDev.get(dev).putIfAbsent(ch, v);
                }
            }
        }

        log.info("CONSO {} baseline DB loaded for {} device(s)", building, deviceIds.size());
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
                .metricType(parseMetricType(metricType))
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
            @RequestParam(required = false) String deviceIds
    ) {
        final String appId = mapBuildingToAppId(building);

        List<String> ids =
                deviceIds == null || deviceIds.isBlank()
                        ? List.of()
                        : Arrays.asList(deviceIds.split(","));

        return sensorService
                .getMonitoringMany(appId, ids)
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


    // =========================
    // Helpers
    // =========================

    private static class ParsedUplink {
        final String deviceId;
        final com.fasterxml.jackson.databind.JsonNode decodedPayload;
        ParsedUplink(String deviceId, com.fasterxml.jackson.databind.JsonNode decodedPayload) {
            this.deviceId = deviceId;
            this.decodedPayload = decodedPayload;
        }
    }

    private ParsedUplink parseUplink(String json) {
        try {
            var root = om.readTree(json);
            var r = root.has("result") ? root.get("result") : root;

            String deviceId = textAt(r, "/end_device_ids/device_id");
            var decoded = nodeAt(r, "/uplink_message/decoded_payload");
            if (deviceId == null || decoded == null || decoded.isMissingNode() || decoded.isNull()) return null;

            return new ParsedUplink(deviceId, decoded);
        } catch (Exception e) {
            log.debug("parseUplink failed: {}", e.getMessage());
            return null;
        }
    }

    private void applyDecodedPayload(String building, String deviceId, com.fasterxml.jackson.databind.JsonNode decoded) {
        powerW.get(building).computeIfAbsent(deviceId, k -> new java.util.concurrent.ConcurrentHashMap<>());
        energyWhCurrent.get(building).computeIfAbsent(deviceId, k -> new java.util.concurrent.ConcurrentHashMap<>());
        energyWhMinToday.get(building).computeIfAbsent(deviceId, k -> new java.util.concurrent.ConcurrentHashMap<>());

        var fields = decoded.fields();
        while (fields.hasNext()) {
            var e = fields.next();
            var obj = e.getValue();
            if (obj == null || !obj.isObject()) continue;

            String type = obj.path("type").asText(null);
            double value = obj.path("value").isNumber() ? obj.path("value").asDouble() : Double.NaN;

            int channel = obj.path("hardwareData").path("channel").isInt()
                    ? obj.path("hardwareData").path("channel").asInt()
                    : -1;

            if (channel < 0 || channel > 11) continue;
            if (Double.isNaN(value)) continue;

            if ("power".equalsIgnoreCase(type)) {
                powerW.get(building).get(deviceId).put(channel, value);
            } else if ("consumedActiveEnergyIndex".equalsIgnoreCase(type)) {
                energyWhCurrent.get(building).get(deviceId).put(channel, value);
                var baseMap = energyWhMinToday.get(building).get(deviceId);
                baseMap.putIfAbsent(channel, value);
            }
        }
    }

    private ConsoLiveAggregate computeAggregate(String building) {
        long now = System.currentTimeMillis();

        double[] c = new double[12]; // C0..C11
        var devices = powerW.getOrDefault(building, Map.of());

        for (var devEntry : devices.entrySet()) {
            var map = devEntry.getValue();
            for (int ch = 0; ch <= 11; ch++) {
                Double v = map.get(ch);
                if (v != null) c[ch] += v;
            }
        }

        // 1) absolu par channel (pas par groupe)
        double[] a = new double[12];
        for (int i = 0; i < 12; i++) a[i] = Math.abs(c[i]);

        double red = a[0] + a[1] + a[2];
        double white = Math.abs(
                (a[6] + a[7] + a[8]) - (a[3] + a[4] + a[5])
        );
        double vent = a[6] + a[7] + a[8];
        double other = a[9] + a[10] + a[11];
        double powerTotalW = Math.abs(red + white + vent + other);


        log.info("CONSO {} channels (power): C0={} C1={} C2={} C3={} C4={} C5={} C6={} C7={} C8={} C9={} C10={} C11={}",
                building,
                c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], c[10], c[11]
        );
        double[] d = new double[12];

        var curByDev = energyWhCurrent.getOrDefault(building, Map.of());
        var baseByDev = energyWhMinToday.getOrDefault(building, Map.of()); // baseline

        for (var dev : curByDev.keySet()) {
            var curMap = curByDev.getOrDefault(dev, Map.of());
            var baseMap = baseByDev.getOrDefault(dev, Map.of());

            for (int ch = 0; ch <= 11; ch++) {
                Double cur = curMap.get(ch);
                Double base = baseMap.get(ch);
                if (cur == null || base == null) continue;

                double delta = cur - base;

                if (delta < 0) delta = cur;

                d[ch] += delta;
            }
        }

        double todayEnergyWh = computeTodayEnergyWh(building);
        int deviceCount = powerW.getOrDefault(building, Map.of()).size();

        return new ConsoLiveAggregate(
                building,
                powerTotalW,
                powerTotalW / 1000d,
                todayEnergyWh,
                todayEnergyWh / 1000d,
                deviceCount,
                now
        );
    }

    private void resetIfNewDay(String building) {
        ZoneId zone = ZoneId.of("Europe/Paris");
        LocalDate today = LocalDate.now(zone);

        LocalDate last = lastDaySeen.putIfAbsent(building, today);

        if (last == null) return;

        if (!last.equals(today)) {
            energyWhMinToday.computeIfAbsent(building, k -> new ConcurrentHashMap<>()).clear();
            energyWhCurrent.computeIfAbsent(building, k -> new ConcurrentHashMap<>()).clear();
            lastDaySeen.put(building, today);
        }
    }

    private String textAt(com.fasterxml.jackson.databind.JsonNode node, String jsonPointer) {
        var n = node.at(jsonPointer);
        return (n == null || n.isMissingNode() || n.isNull()) ? null : n.asText(null);
    }

    private com.fasterxml.jackson.databind.JsonNode nodeAt(com.fasterxml.jackson.databind.JsonNode node, String jsonPointer) {
        var n = node.at(jsonPointer);
        return (n == null) ? com.fasterxml.jackson.databind.node.MissingNode.getInstance() : n;
    }

}


