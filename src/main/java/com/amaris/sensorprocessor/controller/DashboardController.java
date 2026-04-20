package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.entity.Building;
import com.amaris.sensorprocessor.entity.DeviceType;
import com.amaris.sensorprocessor.entity.Gateway;
import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.amaris.sensorprocessor.entity.User;
import com.amaris.sensorprocessor.model.dashboard.*;
import com.amaris.sensorprocessor.service.AlertService;
import com.amaris.sensorprocessor.service.BuildingService;
import com.amaris.sensorprocessor.service.DashboardService;
import com.amaris.sensorprocessor.service.DeviceTypeService;
import com.amaris.sensorprocessor.service.GatewayService;
import com.amaris.sensorprocessor.service.SensorService;
import com.amaris.sensorprocessor.service.UserService;
import com.amaris.sensorprocessor.repository.SensorDataDao;
import com.amaris.sensorprocessor.repository.BuildingEnergyConfigDao;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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

@Slf4j
@Controller
public class DashboardController {

    private final SensorService sensorService;
    private final UserService userService;
    private final DashboardService dashboardService;
    private final AlertService alertService;
    private final GatewayService gatewayService;
    private final BuildingService buildingService;
    private final DeviceTypeService deviceTypeService;
    private final SensorDataDao sensorDataDao;
    private final BuildingEnergyConfigDao buildingEnergyConfigDao;

    private static final String DEFAULT_APP_ID = "rpi-mantu-appli";

    private final ObjectMapper om = new ObjectMapper();

    // POWER (W) : building -> device -> channel(0..11) -> lastW
    private final Map<String, Map<String, Map<Integer, Double>>> powerW = new ConcurrentHashMap<>();

    // devices conso par building (pour calcul energy DB)
    private final Map<String, List<String>> consoDevicesByBuilding = new ConcurrentHashMap<>();

    // Pour reset quotidien (si tu veux reset d’autres trucs plus tard)
    private final Map<String, LocalDate> lastDaySeen = new ConcurrentHashMap<>();

    // Cache énergie DB (2 min TTL par building)
    private final Map<String, Double> cachedEnergyWh = new ConcurrentHashMap<>();
    private final Map<String, Instant> energyLastComputed = new ConcurrentHashMap<>();

    // Cache building -> appId (invariant en runtime)
    private final Map<String, String> buildingToAppIdCache = new ConcurrentHashMap<>();

    // Tracker dernier message reçu par device (pour nettoyage fuite mémoire)
    private final Map<String, Map<String, Instant>> powerLastSeen = new ConcurrentHashMap<>();

    @Autowired
    public DashboardController(
            UserService userService,
            DashboardService dashboardService,
            AlertService alertService,
            SensorService sensorService,
            GatewayService gatewayService,
            BuildingService buildingService,
            DeviceTypeService deviceTypeService,
            SensorDataDao sensorDataDao,
            BuildingEnergyConfigDao buildingEnergyConfigDao
    ) {
        this.userService = userService;
        this.dashboardService = dashboardService;
        this.alertService = alertService;
        this.sensorService = sensorService;
        this.gatewayService = gatewayService;
        this.buildingService = buildingService;
        this.deviceTypeService = deviceTypeService;
        this.sensorDataDao = sensorDataDao;
        this.buildingEnergyConfigDao = buildingEnergyConfigDao;
    }

    @GetMapping("/dashboard")
    public String dashboard(Model model, Principal principal) {
        User user = userService.searchUserByUsername(principal.getName());
        model.addAttribute("user", user);
        model.addAttribute("loggedUsername", user.getUsername());
        model.addAttribute("deviceTypes", resolveDashboardDeviceTypes());
        return "dashboard";
    }

    @GetMapping("/api/alerts")
    @ResponseBody
    public List<Alert> getAlerts(@RequestParam(required = false) String building) {
        Integer buildingId = building != null ? mapBuildingToId(building) : null;
        return alertService.getCurrentAlerts(buildingId);
    }

    @GetMapping(value = "/api/alerts/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @ResponseBody
    public Flux<ServerSentEvent<String>> streamAlerts(
            @RequestParam(required = false) String building
    ) {
        Integer buildingId = building != null ? mapBuildingToId(building) : null;
        
        // Periodic alert refresh (every 2 minutes - sensors update on value change or every 10min)
        Flux<ServerSentEvent<String>> alertStream = Flux.interval(Duration.ofMinutes(2))
                .publishOn(Schedulers.boundedElastic())
                .map(tick -> {
                    try {
                        List<Alert> alerts = alertService.getCurrentAlerts(buildingId);
                        String json = om.writeValueAsString(alerts);
                        return ServerSentEvent.<String>builder(json)
                                .event("alert_update")
                                .build();
                    } catch (Exception e) {
                        log.error("Error streaming alerts: {}", e.getMessage());
                        return ServerSentEvent.<String>builder("[]")
                                .event("alert_update")
                                .build();
                    }
                });
        
        // Keepalive every 60 seconds
        Flux<ServerSentEvent<String>> keepAlive = Flux.interval(Duration.ofSeconds(60))
                .map(t -> ServerSentEvent.<String>builder("ping")
                        .event("keepalive")
                        .build());
        
        // Initial alerts on connect
        Flux<ServerSentEvent<String>> initialAlerts = Mono.fromCallable(() -> {
            try {
                List<Alert> alerts = alertService.getCurrentAlerts(buildingId);
                String json = om.writeValueAsString(alerts);
                return ServerSentEvent.<String>builder(json)
                        .event("alert_update")
                        .build();
            } catch (Exception e) {
                return ServerSentEvent.<String>builder("[]")
                        .event("alert_update")
                        .build();
            }
        }).subscribeOn(Schedulers.boundedElastic()).flux();
        
        return initialAlerts.concatWith(alertStream.mergeWith(keepAlive));
    }

    private Integer mapBuildingToId(String building) {
        if (building == null || building.isBlank() || "all".equalsIgnoreCase(building)) {
            return null; // null = pas de filtre, tous les bâtiments
        }

        // Cas 1 : le frontend envoie déjà un ID numérique → retour direct
        if (isInteger(building)) {
            return Integer.parseInt(building);
        }

        // Cas 2 : le frontend envoie un label texte → résolution via DB
        return buildingService.findAll().stream()
                .filter(b -> b.getName().equalsIgnoreCase(building.trim())
                        || b.getName().toUpperCase().contains(building.trim().toUpperCase()))
                .map(Building::getId)
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Building not found: " + building));
    }

    private List<DeviceType> resolveDashboardDeviceTypes() {
        Map<String, DeviceType> deviceTypesByFamily = new LinkedHashMap<>();

        deviceTypeService.findAll().stream()
                .filter(Objects::nonNull)
                .filter(dt -> dt.getLabel() != null && !dt.getLabel().isBlank())
                .filter(dt -> dt.getTypeName() == null || !"ALL".equalsIgnoreCase(dt.getTypeName()))
                .sorted(Comparator
                        .comparing((DeviceType dt) -> isLegacyDashboardDeviceType(dt.getTypeName()))
                        .thenComparing(dt -> dt.getLabel().toUpperCase(Locale.ROOT)))
                .forEach(dt -> deviceTypesByFamily.putIfAbsent(resolveDashboardDeviceTypeName(dt), toDashboardDeviceType(dt)));

        return deviceTypesByFamily.values().stream()
                .sorted(Comparator.comparing(dt -> dt.getLabel().toUpperCase(Locale.ROOT)))
                .toList();
    }

    private DeviceType toDashboardDeviceType(DeviceType source) {
        DeviceType deviceType = new DeviceType();
        deviceType.setIdDeviceType(source.getIdDeviceType());
        deviceType.setTypeName(resolveDashboardDeviceTypeName(source));
        deviceType.setLabel(source.getLabel());
        return deviceType;
    }

    private String resolveDashboardDeviceTypeName(DeviceType deviceType) {
        String typeName = deviceType.getTypeName();
        if (typeName == null || typeName.isBlank()) {
            return deviceType.getLabel();
        }

        return switch (typeName.trim().toUpperCase(Locale.ROOT)) {
            case "NOISE" -> "SON";
            case "ENERGY" -> "CONSO";
            default -> typeName.trim().toUpperCase(Locale.ROOT);
        };
    }

    private boolean isLegacyDashboardDeviceType(String typeName) {
        if (typeName == null) {
            return false;
        }
        String normalized = typeName.trim().toUpperCase(Locale.ROOT);
        return "NOISE".equals(normalized) || "ENERGY".equals(normalized);
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

        Flux<ServerSentEvent<String>> keepAlive =
                Flux.interval(Duration.ofSeconds(15))
                        .map(t -> ServerSentEvent.<String>builder("ping")
                                .event("keepalive")
                                .build());

        return sensorService.getMonitoringMany(appId, List.of())
                .filter(sse -> sse.data() != null && !sse.data().isBlank())
                .map(sse -> ServerSentEvent.<String>builder(sse.data())
                        .event(sse.event() != null ? sse.event() : "uplink")
                        .build())
                .mergeWith(keepAlive);
    }

    private String mapBuildingToAppId(String building) {
        if (building == null || building.isBlank() || "all".equalsIgnoreCase(building)) {
            return DEFAULT_APP_ID;
        }
        return buildingToAppIdCache.computeIfAbsent(building, key -> {
            String appId = "";
            if (isInteger(key)) {
                List<Gateway> gateway = gatewayService.findByBuildingId(Integer.parseInt(key));
                if (!gateway.isEmpty()) {
                    String gatewayId = gateway.get(0).getGatewayId();
                    if (gatewayId.equals("leva-rpi-mantu")) {
                        appId = "lorawan-network-mantu";
                    } else {
                        appId = gatewayId + "-appli";
                    }
                }
            }
            return appId;
        });
    }

    private boolean isInteger(String s) {
        try {
            Integer.parseInt(s);
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    @GetMapping(value = "/api/dashboard/conso/live/aggregate/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @ResponseBody
    public Flux<ServerSentEvent<ConsoLiveAggregate>> streamConsoAggregate(@RequestParam String building) {
        final String appId = mapBuildingToAppId(building);

        List<SensorInfo> sensors = dashboardService.getSensorsList(
                String.valueOf(mapBuildingToId(building)),
                null,
                "CONSO,ENERGY"
        );

        List<String> consoDeviceIds = sensors.stream()
                .map(SensorInfo::getIdSensor)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .filter(id -> id.toLowerCase().startsWith("cons"))
                .distinct()
                .toList();

        if (consoDeviceIds.isEmpty()) {
            log.warn("[Conso SSE] No conso device found for building={}", building);
            return Flux.interval(Duration.ofSeconds(15))
                    .map(t -> {
                        ConsoLiveAggregate dto = new ConsoLiveAggregate(
                                building,               // String
                                0d,                     // powerTotalW      (double)
                                0d,                     // powerTotalkW     (double)
                                0d,                     // todayEnergyWh    (double)
                                0d,                     // todayEnergykWh   (double)
                                0,                      // deviceCount      (int)
                                System.currentTimeMillis() // updatedAtEpochMs (long)
                        );
                        return ServerSentEvent.<ConsoLiveAggregate>builder(dto)
                                .event("keepalive")
                                .build();
                    });
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
                .filter(sse -> sse.data() != null && !sse.data().isBlank())
                .flatMap(sse -> {
                    try {
                        resetIfNewDay(building);

                        ParsedUplink p = parseUplink(sse.data());
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

        Instant lastComputed = energyLastComputed.get(building);
        if (lastComputed != null && Duration.between(lastComputed, Instant.now()).toSeconds() < 120) {
            return cachedEnergyWh.getOrDefault(building, 0d);
        }

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

        double result = Math.abs(redWh + whiteWh + ventWh + otherWh);
        cachedEnergyWh.put(building, result);
        energyLastComputed.put(building, Instant.now());
        return result;
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
        powerLastSeen.computeIfAbsent(building, k -> new ConcurrentHashMap<>()).put(deviceId, Instant.now());

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
            cachedEnergyWh.remove(building);
            energyLastComputed.remove(building);
            lastDaySeen.put(building, today);
        }

        Instant cutoff = Instant.now().minus(24, ChronoUnit.HOURS);
        Map<String, Instant> devicesSeen = powerLastSeen.get(building);
        if (devicesSeen != null) {
            devicesSeen.entrySet().removeIf(entry -> {
                if (entry.getValue().isBefore(cutoff)) {
                    Map<String, Map<Integer, Double>> buildingPower = powerW.get(building);
                    if (buildingPower != null) buildingPower.remove(entry.getKey());
                    return true;
                }
                return false;
            });
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
                .filter(sse -> sse.data() != null && !sse.data().isBlank())
                .map(sse -> ServerSentEvent.<String>builder(sse.data())
                        .event(sse.event() != null ? sse.event() : "uplink")
                        .build())
                .mergeWith(
                        Flux.interval(Duration.ofSeconds(15))
                                .map(t -> ServerSentEvent.<String>builder("ping").event("keepalive").build())
                );
    }

    /**
     * API endpoint for environment history data (temperature, humidity, CO2, sound)
     * Returns aggregated hourly data for charts
     */
    @GetMapping("/api/dashboard/environment/debug")
    @ResponseBody
    public Map<String, Object> debugEnvironmentData(@RequestParam(required = false) String building) {
        Map<String, Object> result = new HashMap<>();
        Integer buildingId = building != null ? mapBuildingToId(building) : null;
        result.put("queryBuilding", building);
        result.put("buildingId", buildingId);
        
        List<String> co2SensorIds = sensorService.getSensorIdsByTypeAndBuilding("CO2", buildingId);
        result.put("co2SensorIds", co2SensorIds);
        
        // Check what data exists for each sensor
        List<Map<String, Object>> sensorDataInfo = new java.util.ArrayList<>();
        for (String sensorId : co2SensorIds) {
            Map<String, Object> info = new HashMap<>();
            info.put("sensorId", sensorId);
            
            var tempData = sensorDataDao.findLatestBySensorAndType(sensorId, PayloadValueType.TEMPERATURE);
            var co2Data = sensorDataDao.findLatestBySensorAndType(sensorId, PayloadValueType.CO2);
            var humData = sensorDataDao.findLatestBySensorAndType(sensorId, PayloadValueType.HUMIDITY);
            
            info.put("latestTemp", tempData.map(d -> d.getReceivedAt().toString() + " = " + d.getValueAsString()).orElse("NONE"));
            info.put("latestCO2", co2Data.map(d -> d.getReceivedAt().toString() + " = " + d.getValueAsString()).orElse("NONE"));
            info.put("latestHumidity", humData.map(d -> d.getReceivedAt().toString() + " = " + d.getValueAsString()).orElse("NONE"));
            
            sensorDataInfo.add(info);
        }
        result.put("sensorData", sensorDataInfo);
        
        return result;
    }

    @GetMapping("/api/dashboard/environment/history")
    @ResponseBody
    public Map<String, Object> getEnvironmentHistory(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String building
    ) {
        Map<String, Object> result = new HashMap<>();
        
        // Use LocalDateTime directly to match database storage format
        java.time.LocalDateTime startDateTime = from.atStartOfDay();
        java.time.LocalDateTime endDateTime = to.plusDays(1).atStartOfDay();
        
        // Get sensor IDs by type for the building
        Integer buildingId = building != null ? mapBuildingToId(building) : null;
        log.info("🌡️ Environment history request: from={}, to={}, building={}, buildingId={}", from, to, building, buildingId);
        
        List<String> tempSensorIds = new java.util.ArrayList<>(sensorService.getSensorIdsByTypeAndBuilding("CO2", buildingId));
        tempSensorIds.addAll(sensorService.getSensorIdsByTypeAndBuilding("TEMPEX", buildingId));
        
        List<String> humiditySensorIds = new java.util.ArrayList<>(sensorService.getSensorIdsByTypeAndBuilding("CO2", buildingId));
        humiditySensorIds.addAll(sensorService.getSensorIdsByTypeAndBuilding("HUMIDITY", buildingId));
        
        List<String> co2SensorIds = sensorService.getSensorIdsByTypeAndBuilding("CO2", buildingId);
        
        List<String> noiseSensorIds = sensorService.getSensorIdsByTypeAndBuilding("SON", buildingId);
        
        // Get aggregated data for each type using LocalDateTime
        result.put("temperature", sensorDataDao.findAggregatedDataByPeriodAndType(
                tempSensorIds, startDateTime, endDateTime, PayloadValueType.TEMPERATURE, "AVG"));
        
        result.put("humidity", sensorDataDao.findAggregatedDataByPeriodAndType(
                humiditySensorIds, startDateTime, endDateTime, PayloadValueType.HUMIDITY, "AVG"));
        
        result.put("co2", sensorDataDao.findAggregatedDataByPeriodAndType(
                co2SensorIds, startDateTime, endDateTime, PayloadValueType.CO2, "AVG"));
        
        result.put("sound", sensorDataDao.findAggregatedDataByPeriodAndType(
                noiseSensorIds, startDateTime, endDateTime, PayloadValueType.LAEQ, "AVG"));
        
        return result;
    }

    @GetMapping("/api/dashboard/energy/cost")
    @ResponseBody
    public Map<String, Object> getEnergyCostData(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) java.time.LocalDate to,
            @RequestParam(required = false) String building) {
        
        Map<String, Object> result = new HashMap<>();
        Integer buildingId = building != null ? mapBuildingToId(building) : null;
        
        // Get energy config for this building
        var energyConfig = buildingEnergyConfigDao.findByBuildingId(buildingId);
        double costPerKwh = energyConfig.map(c -> c.getEnergyCostPerKwh()).orElse(0.0);
        double co2Factor = energyConfig.map(c -> c.getCo2EmissionFactor()).orElse(0.0);
        String currency = energyConfig.map(c -> c.getCurrency()).orElse("EUR");
        
        result.put("costPerKwh", costPerKwh);
        result.put("co2Factor", co2Factor);
        result.put("currency", currency);
        result.put("building", buildingId);
        
        // Get daily energy consumption data
        java.time.LocalDateTime startDateTime = from.atStartOfDay();
        java.time.LocalDateTime endDateTime = to.plusDays(1).atStartOfDay();
        
        // Use substr to get daily buckets (YYYY-MM-DD format, first 10 chars)
        List<String> consoSensorIds = new java.util.ArrayList<>(
                new java.util.LinkedHashSet<>(sensorService.getSensorIdsByTypeAndBuilding("CONSO", buildingId))
        );
        
        List<Map<String, Object>> dailyData = new java.util.ArrayList<>();
        double totalEnergy = 0;
        double totalCost = 0;
        double totalCo2 = 0;
        
        // Query daily aggregated data
        if (!consoSensorIds.isEmpty()) {
            String placeholders = String.join(",", java.util.Collections.nCopies(consoSensorIds.size(), "?"));
            String query = "SELECT substr(received_at, 1, 10) as day, " +
                          "SUM(CAST(value AS REAL)) as total_energy " +
                          "FROM sensor_data " +
                          "WHERE id_sensor IN (" + placeholders + ") " +
                          "AND received_at >= ? AND received_at < ? " +
                          "AND value_type = 'ENERGY' " +
                          "AND value IS NOT NULL " +
                          "GROUP BY substr(received_at, 1, 10) " +
                          "ORDER BY day ASC";
            
            java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");
            String startStr = startDateTime.format(formatter);
            String endStr = endDateTime.format(formatter);
            
            List<Object> params = new java.util.ArrayList<>(consoSensorIds);
            params.add(startStr);
            params.add(endStr);
            
            try {
                var jdbcTemplate = new org.springframework.jdbc.core.JdbcTemplate(
                    ((org.springframework.jdbc.core.JdbcTemplate) 
                    org.springframework.beans.factory.BeanFactoryUtils
                    .beanOfTypeIncludingAncestors(
                        org.springframework.web.context.ContextLoader.getCurrentWebApplicationContext(),
                        org.springframework.jdbc.core.JdbcTemplate.class)).getDataSource());
                
                // Use sensorDataDao's internal method or create simple query
                // For now, return config info - actual data will come from frontend calculation
            } catch (Exception e) {
                log.error("Error querying energy data: {}", e.getMessage());
            }
        }
        
        result.put("dailyData", dailyData);
        result.put("totalEnergy", totalEnergy);
        result.put("totalCost", totalCost);
        result.put("totalCo2", totalCo2);
        
        return result;
    }

    @GetMapping("/api/config/environment")
    @ResponseBody
    public Map<String, Object> getEnvConfig(
            @RequestParam String building,
            @RequestParam(required = false) Integer floor
    ) {
        return dashboardService.getEnvConfig(building, floor);
    }
}
