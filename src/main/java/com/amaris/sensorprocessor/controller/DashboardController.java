package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.entity.BuildingMapping;
import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.amaris.sensorprocessor.entity.User;
import com.amaris.sensorprocessor.model.dashboard.*;
import com.amaris.sensorprocessor.service.AlertService;
import com.amaris.sensorprocessor.service.DashboardService;
import com.amaris.sensorprocessor.service.SensorService;
import com.amaris.sensorprocessor.service.UserService;
import com.amaris.sensorprocessor.repository.SensorDataDao;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.security.Principal;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.time.Duration;

@Slf4j
@Controller
public class DashboardController {

    private final SensorService sensorService;
    private final UserService userService;
    private final DashboardService dashboardService;
    private final AlertService alertService;
    private final SensorDataDao sensorDataDao;

    private final ObjectMapper om = new ObjectMapper();

    // POWER (W) : building -> device -> channel(0..11) -> lastW
    private final Map<String, Map<String, Map<Integer, Double>>> powerW = new ConcurrentHashMap<>();

    // devices conso par building (pour calcul energy DB)
    private final Map<String, List<String>> consoDevicesByBuilding = new ConcurrentHashMap<>();

    // Pour reset quotidien (si tu veux reset d’autres trucs plus tard)
    private final Map<String, LocalDate> lastDaySeen = new ConcurrentHashMap<>();

    @Autowired
    public DashboardController(
            UserService userService,
            DashboardService dashboardService,
            AlertService alertService,
            SensorService sensorService,
            SensorDataDao sensorDataDao
    ) {
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
            @RequestParam(required = false) String timeSlot
    ) {
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

    private static Instant parisStartOfDayInstant() {
        return ZonedDateTime.now(ZoneId.of("Europe/Paris"))
                .toLocalDate()
                .atStartOfDay(ZoneId.of("Europe/Paris"))
                .toInstant();
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
                        .map(t -> ServerSentEvent.<String>builder("ping")
                                .event("keepalive")
                                .build());

        return upstream
                .filter(s -> s != null && !s.isBlank())
                .map(payload -> ServerSentEvent.<String>builder(payload).event("uplink").build())
                .mergeWith(keepAlive);
    }

    private String mapBuildingToAppId(String building) {
        if (building == null || building.isBlank() || "all".equalsIgnoreCase(building)) {
            return "rpi-mantu-appli";
        }
        return switch (building.trim().toUpperCase()) {
            case "CHATEAUDUN", "CHÂTEAUDUN" -> "rpi-mantu-appli";
            case "LEVALLOIS" -> "lorawan-network-mantu";
            case "LILLE" -> "lil-rpi-mantu-appli";
            default -> building;
        };
    }

    @GetMapping(value = "/api/dashboard/conso/live/aggregate/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
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

        // store for DB energy calc
        consoDevicesByBuilding.put(building, consoDeviceIds);

        powerW.computeIfAbsent(building, k -> new ConcurrentHashMap<>());

        Mono<ServerSentEvent<ConsoLiveAggregate>> initial = Mono.fromCallable(() -> {
                    resetIfNewDay(building);
                    ConsoLiveAggregate dto = computeAggregate(building);
                    return ServerSentEvent.<ConsoLiveAggregate>builder(dto).event("conso_aggregate").build();
                })
                .subscribeOn(Schedulers.boundedElastic())
                .onErrorResume(e -> Mono.empty());

        Flux<ServerSentEvent<ConsoLiveAggregate>> live = sensorService.getMonitoringMany(appId, consoDeviceIds)
                .filter(s -> s != null && !s.isBlank())
                .flatMap(json -> {
                    try {
                        resetIfNewDay(building);

                        ParsedUplink p = parseUplink(json);
                        if (p == null || p.deviceId == null || p.decodedPayload == null) {
                            return Mono.empty();
                        }

                        // power only
                        applyDecodedPayloadPowerOnly(building, p.deviceId, p.decodedPayload);

                        ConsoLiveAggregate dto = computeAggregate(building);

                        return Mono.just(ServerSentEvent.<ConsoLiveAggregate>builder(dto)
                                .event("conso_aggregate")
                                .build());
                    } catch (Exception e) {
                        return Mono.empty();
                    }
                });

        Flux<ServerSentEvent<ConsoLiveAggregate>> keepAlive =
                Flux.interval(Duration.ofSeconds(15))
                        .map(t -> {
                            ConsoLiveAggregate dto = computeAggregate(building);
                            return ServerSentEvent.<ConsoLiveAggregate>builder(dto)
                                    .event("keepalive")
                                    .build();
                        });

        return Flux.concat(initial, live).mergeWith(keepAlive);
    }

    // =========================
    // ENERGY via DB (first + last)
    // =========================
    private double computeTodayEnergyWhFromDb(String building) {
        List<String> deviceIds = consoDevicesByBuilding.getOrDefault(building, List.of());
        if (deviceIds.isEmpty()) return 0d;


        Instant start = parisStartOfDayInstant();
        Instant end = start.plus(1, ChronoUnit.DAYS);

        Date dayStart = Date.from(start);
        Date dayEnd = Date.from(end);

        Set<PayloadValueType> energyTypes = new HashSet<>();
        for (int ch = 0; ch <= 11; ch++) {
            energyTypes.add(PayloadValueType.valueOf("ENERGY_CHANNEL_" + ch));
        }

        double[] d = new double[12]; // delta Wh par channel

        for (String dev : deviceIds) {
            Map<PayloadValueType, Double> firsts =
                    sensorDataDao.findFirstValuesOfDayByTypes(dev, energyTypes, dayStart, dayEnd);

            Map<PayloadValueType, Double> lasts =
                    sensorDataDao.findLastValuesOfDayByTypes(dev, energyTypes, dayStart, dayEnd);

            for (int ch = 0; ch <= 11; ch++) {
                PayloadValueType vt = PayloadValueType.valueOf("ENERGY_CHANNEL_" + ch);
                Double f = firsts.get(vt);
                Double l = lasts.get(vt);
                if (f == null || l == null) continue;

                double delta = l - f;
                if (!Double.isFinite(delta) || delta < 0) delta = 0;
                d[ch] += delta;
            }
        }

        double redWh   = d[0] + d[1] + d[2];
        double whiteWh = Math.abs((d[6] + d[7] + d[8]) - (d[3] + d[4] + d[5]));
        double ventWh  = d[6] + d[7] + d[8];
        double otherWh = d[9] + d[10] + d[11];

        return Math.abs(redWh + whiteWh + ventWh + otherWh);
    }

    // =========================
    // Helpers uplink
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

    private void applyDecodedPayloadPowerOnly(String building, String deviceId, com.fasterxml.jackson.databind.JsonNode decoded) {
        powerW.computeIfAbsent(building, k -> new ConcurrentHashMap<>());
        powerW.get(building).computeIfAbsent(deviceId, k -> new ConcurrentHashMap<>());

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
            }
        }
    }

    private ConsoLiveAggregate computeAggregate(String building) {
        long now = System.currentTimeMillis();

        // ---- POWER from memory maps ----
        double[] c = new double[12];
        var devices = powerW.getOrDefault(building, Map.of());

        for (var devEntry : devices.entrySet()) {
            var map = devEntry.getValue();
            for (int ch = 0; ch <= 11; ch++) {
                Double v = map.get(ch);
                if (v != null) c[ch] += v;
            }
        }

        double[] a = new double[12];
        for (int i = 0; i < 12; i++) a[i] = Math.abs(c[i]);

        double red = a[0] + a[1] + a[2];
        double white = Math.abs((a[6] + a[7] + a[8]) - (a[3] + a[4] + a[5]));
        double vent = a[6] + a[7] + a[8];
        double other = a[9] + a[10] + a[11];

        double powerTotalW = Math.abs(red + white + vent + other);

        // ---- ENERGY from DB ----
        double todayEnergyWh = computeTodayEnergyWhFromDb(building);

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
            // ici tu peux reset power si tu veux repartir propre chaque jour:
            // powerW.getOrDefault(building, Map.of()).clear();
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

    // --- autres endpoints existants ---
    @GetMapping("/api/dashboard/sensors")
    @ResponseBody
    public List<SensorInfo> getSensors(
            @RequestParam(required = false) String building,
            @RequestParam(required = false) String floor,
            @RequestParam(required = false) String sensorType
    ) {
        return dashboardService.getSensorsList(building, floor, sensorType);
    }

    @GetMapping("/api/dashboard/occupation-history")
    @ResponseBody
    public List<OccupationHistoryEntry> getOccupationHistory(
            @RequestParam(required = false) List<String> sensorIds,
            @RequestParam(required = false) Integer days
    ) {
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
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") Date customEndDate
    ) {
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

    private PayloadValueType parseMetricType(String metricType) {
        if (metricType == null || metricType.isBlank()) return null;
        final String mt = metricType.trim().toUpperCase();
        try {
            return PayloadValueType.valueOf(mt);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown metricType: " + metricType);
        }
    }

    @GetMapping(value = "/api/dashboard/live/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
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
                .map(payload -> ServerSentEvent.builder(payload).event("uplink").build())
                .mergeWith(
                        Flux.interval(Duration.ofSeconds(15))
                                .map(t -> ServerSentEvent.builder("ping").event("keepalive").build())
                );
    }


    @PostMapping("/monitoring/start")
    public ResponseEntity<String> startMonitoring(
            @RequestParam String building,
            @RequestParam String sensorType) {

        String dbBuildingName = BuildingMapping.toDbName(building);
        alertService.startMonitoringForBuilding(building, sensorType, dbBuildingName);
        return ResponseEntity.ok("Monitoring started for " + building + " / " + sensorType);
    }

}
