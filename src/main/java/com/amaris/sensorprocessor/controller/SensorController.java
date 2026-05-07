package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.constant.Constants;
import com.amaris.sensorprocessor.entity.*;
import com.amaris.sensorprocessor.service.*;

import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.validation.ObjectError;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.security.Principal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Slf4j
@Controller
public class SensorController {

    private static final String ERROR_ADD = "errorAdd";
    private static final String SENSOR_ADD = "sensorAdd";
    private static final String ERROR_EDIT = "errorEdit";
    private static final String SENSOR_EDIT = "sensorEdit";
    private static final String ERROR_DELETE = "errorDelete";

    private static final Pattern DEVICE_ID_PATTERN = Pattern.compile("^[a-z0-9](?:[-]?[a-z0-9]){2,}$");
    private static final Pattern HEX16 = Pattern.compile("^[A-Fa-f0-9]{16}$");
    private static final Pattern HEX32 = Pattern.compile("^[A-Fa-f0-9]{32}$");

    private final SensorService sensorService;
    private final GatewayService gatewayService;
    private final UserService userService;
    private final ProtocolService protocolService;
    private final BrandService brandService;
    private final DeviceTypeService deviceTypeService;
    private final BuildingService buildingService;
    private final com.amaris.sensorprocessor.service.SensorLorawanService sensorLorawanService;
    private final GatewaySyncService gatewaySyncService;
    private final com.amaris.sensorprocessor.service.LocationService locationService;

    @Autowired
    public SensorController(SensorService sensorService, GatewayService gatewayService,
                            UserService userService, SensorLorawanService sensorLorawanService,
                            GatewaySyncService gatewaySyncService, ProtocolService protocolService,
                            BrandService brandService, DeviceTypeService deviceTypeService,
                            BuildingService buildingService,
                            com.amaris.sensorprocessor.service.LocationService locationService) {
        this.sensorService = sensorService;
        this.gatewayService = gatewayService;
        this.userService = userService;
        this.sensorLorawanService = sensorLorawanService;
        this.gatewaySyncService = gatewaySyncService;
        this.protocolService = protocolService;
        this.brandService = brandService;
        this.deviceTypeService = deviceTypeService;
        this.buildingService = buildingService;
        this.locationService = locationService;
    }


    /* ===================== LISTE ===================== */

    @GetMapping("/manage-sensors")
    public String manageSensors(Model model, Principal principal) {
        prepareModel(model);
        User user = userService.searchUserByUsername(principal.getName());
        model.addAttribute("user", user);
        model.addAttribute("loggedUsername", user.getUsername());
        return Constants.PAGE_MANAGE_SENSORS;
    }

    @PostMapping("/manage-sensors")
    public String handleManageSensorsPost(Model model) {
        return redirectWithTimestamp();
    }

    /* ===================== GET ===================== */

    @GetMapping("/api/sensors/zones")
    @ResponseBody
    public ResponseEntity<Map<Integer, Map<String, List<String>>>> getSensorZones(
            @RequestParam Integer buildingId) {

        List<Map<String, Object>> rows = sensorService.findZonesByBuilding(buildingId);

        Map<Integer, Map<String, List<String>>> result = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            Object floorObj = row.get("floor");
            String sensorId = (String) row.get("id_sensor");
            String locationName = (String) row.get("location_name");

            if (floorObj == null || sensorId == null) continue;
            int floor = ((Number) floorObj).intValue();
            if (locationName == null || locationName.isBlank()) locationName = "Unknown";

            result
                .computeIfAbsent(floor, f -> new LinkedHashMap<>())
                .computeIfAbsent(locationName, l -> new ArrayList<>())
                .add(sensorId);
        }

        return ResponseEntity.ok(result);
    }

    @GetMapping("/api/sensors/locations")
    @ResponseBody
    public ResponseEntity<List<com.amaris.sensorprocessor.entity.Location>> getDistinctLocations(
            @RequestParam(required = false) String buildingId,
            @RequestParam(required = false) String floor) {

        List<com.amaris.sensorprocessor.entity.Location> locations;

        if (hasText(buildingId) && hasText(floor)) {
            locations = locationService.findByBuildingAndFloor(
                    Integer.parseInt(buildingId), Integer.parseInt(floor));
        } else if (hasText(buildingId)) {
            locations = locationService.findByBuilding(Integer.parseInt(buildingId));
        } else {
            locations = locationService.findAll();
        }

        return ResponseEntity.ok(locations);
    }

    @GetMapping("/api/sensors/{idSensor}")
    @ResponseBody
    public ResponseEntity<?> getSensor(@PathVariable String idSensor) {
        return sensorService.findByIdSensor(idSensor)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /* ===================== ADD ===================== */

    @PostMapping("/manage-sensors/add")
    public String addSensor(@ModelAttribute(SENSOR_ADD) Sensor sensor,
                            BindingResult bindingResult,
                            Model model) {

        model.addAttribute(SENSOR_ADD, sensor);

        if (isBlank(sensor.getIdSensor())) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "idSensor", "Sensor ID is required"));
        } else if (!DEVICE_ID_PATTERN.matcher(sensor.getIdSensor()).matches()) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "idSensor",
                    "Use lowercase a-z, 0-9 and single '-' (min 3 chars, no leading/trailing '-')"));
        }

        if (sensor.getIdDeviceType() == null) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "idDeviceType", "Device Type is required"));
        }
        if (sensor.getBuildingId() == null) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "buildingName", "Building Name is required"));
        }
        if (sensor.getFloor() == null) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "floor", "Floor is required"));
        }
        if (isBlank(sensor.getIdGateway())) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "idGateway", "Gateway is required"));
        }
        if (isBlank(sensor.getDevEui()) || !HEX16.matcher(sensor.getDevEui()).matches()) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "devEui", "DevEUI must be 16 hex characters"));
        }
        if (isBlank(sensor.getJoinEui()) || !HEX16.matcher(sensor.getJoinEui()).matches()) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "joinEui", "JoinEUI must be 16 hex characters"));
        }
        if (isBlank(sensor.getAppKey()) || !HEX32.matcher(sensor.getAppKey()).matches()) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "appKey", "AppKey must be 32 hex characters"));
        }
        if (sensor.getBrandId() == null) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "brandId", "Brand is required"));
        }
        if (sensor.getProtocolId() == null) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "protocolId", "Protocol is required"));
        }
        if (isBlank(sensor.getFrequencyPlan()) && !isBlank(sensor.getIdGateway())) {
            Optional<Gateway> gw = gatewayService.findById(sensor.getIdGateway());
            gw.ifPresent(g -> sensor.setFrequencyPlan(g.getFrequencyPlan()));
        }

        if (bindingResult.hasErrors()) {
            prepareModel(model);
            model.addAttribute(Constants.BINDING_SENSOR_ADD, bindingResult);
            model.addAttribute(ERROR_ADD, Constants.INPUT_ERROR);
            return Constants.PAGE_MANAGE_SENSORS;
        }

        try {
            sensorService.create(sensor);
        } catch (IllegalArgumentException | IllegalStateException e) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "idSensor", e.getMessage()));
            prepareModel(model);
            model.addAttribute(Constants.BINDING_SENSOR_ADD, bindingResult);
            model.addAttribute(ERROR_ADD, e.getMessage());
            return Constants.PAGE_MANAGE_SENSORS;
        } catch (Exception e) {
            log.error("[Sensors] Add failed", e);
            prepareModel(model);
            model.addAttribute(ERROR_ADD, Constants.DATABASE_PROBLEM);
            return Constants.PAGE_MANAGE_SENSORS;
        }

        model.addAttribute(ERROR_ADD, null);
        return redirectWithTimestamp();
    }

    /* ===================== MONITORING ===================== */

    @GetMapping("/manage-sensors/monitoring/{idSensor}")
    public String monitorSensor(@PathVariable String idSensor, Model model,
                                Principal principal, HttpSession session) {
        Sensor s = sensorService.getOrThrow(idSensor);
        model.addAttribute("sensor", s);

        DeviceType deviceType = deviceTypeService.findById(s.getIdDeviceType()).orElse(null);
        String deviceTypeCode = resolveDeviceTypeCode(deviceType);
        String deviceTypeLabel = resolveDeviceTypeLabel(deviceType);
        model.addAttribute("deviceTypeCode", deviceTypeCode);
        model.addAttribute("deviceTypeLabel", deviceTypeLabel);

        if (s.getBuildingId() != null) {
            buildingService.findById(s.getBuildingId())
                    .ifPresent(b -> model.addAttribute("sensorBuildingName", b.getName()));
        }

        gatewayService.findById(s.getIdGateway()).ifPresent(gw -> {
            String buildingLabel = gw.getBuildingId() != null
                    ? buildingService.findById(gw.getBuildingId())
                    .map(b -> b.getName() + " (" + gw.getGatewayId() + ")")
                    .orElse(gw.getGatewayId())
                    : gw.getGatewayId();
            model.addAttribute("gatewayName", buildingLabel);
            model.addAttribute("gatewayIp", gw.getIpAddress());
        });

        String sseToken = UUID.randomUUID().toString();
        session.setAttribute("SSE_TOKEN__" + idSensor, sseToken);
        model.addAttribute("sseToken", sseToken);

        User user = userService.searchUserByUsername(principal.getName());
        model.addAttribute("user", user);
        model.addAttribute("loggedUsername", user.getUsername());
        return "monitoringSensor";
    }

    @GetMapping("/manage-sensors/add")
    public String handleAddGet() {
        return redirectWithTimestamp();
    }

    /* ===================== EDIT ===================== */

    @GetMapping("/manage-sensors/edit/{idSensor}")
    public String editSensor(@PathVariable String idSensor, Model model, Principal principal) {
        prepareModel(model);
        try {
            Sensor sensor = sensorService.getOrThrow(idSensor);
            model.addAttribute(SENSOR_EDIT, sensor);
        } catch (Exception e) {
            model.addAttribute(SENSOR_EDIT, new Sensor());
            model.addAttribute(ERROR_EDIT, Constants.SENSOR_NOT_FOUND);
        }
        User user = userService.searchUserByUsername(principal.getName());
        model.addAttribute("user", user);
        model.addAttribute("loggedUsername", user.getUsername());
        return Constants.PAGE_MANAGE_SENSORS;
    }

    @GetMapping("/manage-sensors/edit")
    public String handleEditGet(@RequestParam(required = false) String idSensor,
                                Model model, Principal principal) {
        if (idSensor == null) return redirectWithTimestamp();
        User user = userService.searchUserByUsername(principal.getName());
        model.addAttribute("user", user);
        model.addAttribute("loggedUsername", user.getUsername());
        return editSensor(idSensor, model, principal);
    }

    @PostMapping("/manage-sensors/edit")
    public String updateSensor(@ModelAttribute(SENSOR_EDIT) Sensor sensor,
                               BindingResult bindingResult,
                               Model model) {
        model.addAttribute(SENSOR_EDIT, sensor);

        if (bindingResult.hasErrors()) {
            prepareModel(model);
            model.addAttribute(Constants.BINDING_SENSOR_EDIT, bindingResult);
            model.addAttribute(ERROR_EDIT, Constants.INPUT_ERROR);
            return Constants.PAGE_MANAGE_SENSORS;
        }

        try {
            sensorService.update(sensor.getIdSensor(), sensor);
        } catch (IllegalArgumentException | IllegalStateException e) {
            prepareModel(model);
            model.addAttribute(ERROR_EDIT, e.getMessage());
            return Constants.PAGE_MANAGE_SENSORS;
        } catch (Exception e) {
            log.error("[Sensors] Edit failed", e);
            prepareModel(model);
            model.addAttribute(ERROR_EDIT, Constants.DATABASE_PROBLEM);
            return Constants.PAGE_MANAGE_SENSORS;
        }

        model.addAttribute(ERROR_EDIT, null);
        return redirectWithTimestamp();
    }

    @PostMapping("/api/sensors/{idSensor}/location")
    @ResponseBody
    public ResponseEntity<?> updateSensorLocation(
            @PathVariable String idSensor,
            @RequestBody Map<String, Object> body) {

        Object locationIdRaw = body.get("locationId");

        if (locationIdRaw == null) {
            return ResponseEntity
                    .badRequest()
                    .body(Map.of("error", "locationId field is required"));
        }

        Integer locationId;
        try {
            locationId = Integer.parseInt(locationIdRaw.toString());
        } catch (NumberFormatException e) {
            return ResponseEntity
                    .badRequest()
                    .body(Map.of("error", "locationId must be an integer"));
        }

        try {
            locationService.findById(locationId)
                    .orElseThrow(() -> new IllegalArgumentException("Location not found: " + locationId));

            Sensor existing = sensorService.getOrThrow(idSensor);
            existing.setLocationId(locationId);
            sensorService.update(idSensor, existing);
            return ResponseEntity.ok(Map.of(
                    "message", "Location updated successfully",
                    "sensorId", idSensor,
                    "locationId", locationId
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity
                    .status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("[API] Error updating sensor location for {}: {}", idSensor, e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to update location"));
        }
    }

    /* ===================== DELETE ===================== */

    @PostMapping("/manage-sensors/delete/{idSensor}")
    public String deleteSensor(@PathVariable String idSensor, Model model) {
        BindingResult br = new BeanPropertyBindingResult(new Sensor(), "deleteSensor");
        try {
            sensorService.delete(idSensor);
        } catch (Exception e) {
            br.addError(new ObjectError("deleteSensor", "sensorProblem"));
            prepareModel(model);
            if (e instanceof IllegalArgumentException) {
                model.addAttribute(ERROR_DELETE, Constants.SENSOR_NOT_FOUND);
            } else {
                model.addAttribute(ERROR_DELETE, Constants.DATABASE_PROBLEM);
            }
            return Constants.PAGE_MANAGE_SENSORS;
        }
        model.addAttribute(ERROR_DELETE, null);
        return redirectWithTimestamp();
    }

    /* ===================== TTN API ===================== */

    @GetMapping("/api/sensors/gateway/{gatewayId}/devices")
    @ResponseBody
    public String getDevicesFromTTN(@PathVariable String gatewayId) {
        try {
            return sensorLorawanService.fetchDevicesForGateway(gatewayId);
        } catch (Exception e) {
            log.error("[API] Error fetching devices for gateway {}: {}", gatewayId, e.getMessage());
            return "{\"error\":\"" + e.getMessage() + "\"}";
        }
    }

    @PostMapping("/api/sensors/gateway/{gatewayId}/sync")
    @ResponseBody
    public String syncSensorsFromTTN(@PathVariable String gatewayId) {
        try {
            int syncCount = gatewaySyncService.syncGateway(gatewayId);
            return "{\"success\":true,\"syncCount\":" + syncCount + ",\"message\":\"Synchronized " + syncCount + " sensors from TTN\"}";
        } catch (Exception e) {
            log.error("[API] Error syncing sensors for gateway {}: {}", gatewayId, e.getMessage());
            return "{\"success\":false,\"error\":\"" + e.getMessage() + "\"}";
        }
    }

    @GetMapping("/api/sensors/gateway/{gatewayId}/compare")
    @ResponseBody
    public GatewaySyncService.SyncReport compareSensorsWithTTN(@PathVariable String gatewayId) {
        return gatewaySyncService.compareWithTTN(gatewayId);
    }

    /* ===================== SSE STREAM ===================== */

    @GetMapping(value = "/manage-sensors/monitoring/{idSensor}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamSensor(@PathVariable String idSensor,
                                   @RequestParam(name = "token") String token,
                                   HttpSession session) {
        String expected = (String) session.getAttribute("SSE_TOKEN__" + idSensor);
        if (expected == null || !expected.equals(token)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid SSE token");
        }

        Sensor sensor = sensorService.getOrThrow(idSensor);

        DeviceType deviceType = deviceTypeService.findById(sensor.getIdDeviceType()).orElse(null);
        String deviceTypeCode = resolveDeviceTypeCode(deviceType);

        String appId = sensor.getIdGateway().equals("leva-rpi-mantu")
                ? "lorawan-network-mantu"
                : sensor.getIdGateway() + "-appli";

        SseEmitter emitter = new SseEmitter(3600000L);

        emitter.onCompletion(() -> log.info("[Sensors] SSE completed for {}", idSensor));
        emitter.onTimeout(() -> {
            log.info("[Sensors] SSE timeout for {}", idSensor);
            emitter.complete();
        });

        var normalizer = new SensorEventNormalizer();

        var subscription = sensorService.getMonitoringData(appId, idSensor)
                .subscribe(
                        sse -> {
                            try {
                                String eventType = sse.event() != null ? sse.event() : "uplink";
                                String normalizedJson = normalizer.normalizeToMonitoringSensorDataJson(
                                        sse.data(), appId, sensor, deviceTypeCode
                                );
                                emitter.send(SseEmitter.event()
                                        .name(eventType)
                                        .data(normalizedJson));
                            } catch (IOException e) {
                                emitter.completeWithError(e);
                            }
                        },
                        err -> {
                            log.error("[Sensors] SSE error for {}: {}", idSensor, err.toString());
                            emitter.completeWithError(err);
                        },
                        emitter::complete
                );

        emitter.onCompletion(subscription::dispose);
        emitter.onTimeout(subscription::dispose);

        return emitter;
    }

    /* ===================== DATA API ===================== */

    @GetMapping(value = "/manage-sensors/monitoring/{idGateway}/{idSensor}/{valueType}")
    @ResponseBody
    public LinkedHashMap<LocalDateTime, String> getSensorDataByPeriod(
            @PathVariable String idGateway,
            @PathVariable String idSensor,
            @PathVariable PayloadValueType valueType,
            @RequestParam("startDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) Date startDate,
            @RequestParam("endDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) Date endDate) {
        try {
            return sensorService.findSensorDataByPeriodAndType(idSensor, startDate, endDate, valueType, Optional.empty());
        } catch (Exception e) {
            log.error("[API] Error fetching data for sensor {}: {}", idSensor, e.getMessage(), e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error fetching sensor data", e);
        }
    }

    @GetMapping(value = "/manage-sensors/monitoring/{idGateway}/{idSensor}/history")
    @ResponseBody
    public Map<String, Object> getSensorHistory(
            @PathVariable String idGateway,
            @PathVariable String idSensor,
            @RequestParam("startDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Date startDate,
            @RequestParam("endDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Date endDate) {

        Map<PayloadValueType, LinkedHashMap<LocalDateTime, String>> dataGroupedByValueType =
                sensorService.findSensorDataByPeriod(idSensor, startDate, endDate);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("idSensor", idSensor);
        response.put("idGateway", idGateway);
        response.put("startDate", startDate != null ? startDate : "beginning");
        response.put("endDate", endDate != null ? endDate : "now");
        response.put("data", dataGroupedByValueType);
        return response;
    }

    @GetMapping(value = "/manage-sensors/monitoring/{idGateway}/{idSensor}/consumption")
    @ResponseBody
    public Map<Date, Double> getSensorConsumptionByChannels(
            @PathVariable String idGateway,
            @PathVariable String idSensor,
            @RequestParam("startDate") String startDateStr,
            @RequestParam("endDate") String endDateStr,
            @RequestParam("channels") List<String> channels) {
        try {
            Date startDate = Date.from(java.time.Instant.parse(startDateStr));
            Date endDate = Date.from(java.time.Instant.parse(endDateStr));
            return sensorService.getConsumptionByChannels(idSensor, startDate, endDate, channels);
        } catch (java.time.format.DateTimeParseException e) {
            log.error("[API] Invalid date format. startDate='{}', endDate='{}'", startDateStr, endDateStr, e);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date format. Please use ISO 8601 format.", e);
        }
    }

    @GetMapping("/manage-sensors/monitoring/{idSensor}/consumption/current")
    @ResponseBody
    public ResponseEntity<Map<String, Double>> getCurrentConsumption(
            @PathVariable String idSensor,
            @RequestParam("channels") List<String> channels,
            @RequestParam(value = "minutes", defaultValue = "10") int minutes) {
        Double consumption = sensorService.getCurrentConsumption(idSensor, channels, minutes);
        if (consumption == null) {
            return ResponseEntity.ok(Map.of("consumption", 0.0));
        }
        return ResponseEntity.ok(Map.of("consumption", consumption));
    }

    /* ===================== PRIVÉS ===================== */

    private void prepareModel(Model model) {
        List<Sensor> sensors = sensorService.findAll();
        List<Gateway> gateways = gatewayService.getAllGateways();

        model.addAttribute("sensors", sensors);
        model.addAttribute("gateways", gateways);
        model.addAttribute("protocols", protocolService.findAll());
        model.addAttribute("brands", brandService.findAll());
        model.addAttribute("deviceTypes", deviceTypeService.findAll());

        List<Building> buildings = buildingService.findAll();
        model.addAttribute("buildings", buildings);
        model.addAttribute("locations", locationService.findAll());

        List<Map<String, Object>> buildingFloors = buildings.stream()
                .map(b -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", b.getId());
                    m.put("name", b.getName());
                    m.put("floorsCount", b.getFloorsCount());
                    return m;
                })
                .collect(Collectors.toList());
        model.addAttribute("buildingFloors", buildingFloors);

        if (!model.containsAttribute(SENSOR_ADD)) {
            model.addAttribute(SENSOR_ADD, new Sensor());
        }
    }

    private String redirectWithTimestamp() {
        return "redirect:/manage-sensors?_=" + System.currentTimeMillis();
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private static boolean hasText(String s) {
        return s != null && !s.isBlank();
    }

    private String resolveDeviceTypeCode(DeviceType deviceType) {
        if (deviceType == null) {
            return "GENERIC";
        }
        String typeName = deviceType.getTypeName();
        if (typeName != null && !typeName.isBlank()) {
            return typeName;
        }
        String label = deviceType.getLabel();
        return label != null && !label.isBlank() ? label : "GENERIC";
    }

    private String resolveDeviceTypeLabel(DeviceType deviceType) {
        if (deviceType == null) {
            return "GENERIC";
        }
        String label = deviceType.getLabel();
        if (label != null && !label.isBlank()) {
            return label;
        }
        String typeName = deviceType.getTypeName();
        return typeName != null && !typeName.isBlank() ? typeName : "GENERIC";
    }

    /* ===================== NORMALIZER ===================== */

    static class SensorEventNormalizer {
        private final com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();

        // ✅ Signature mise à jour avec deviceTypeCode
        public String normalizeToMonitoringSensorDataJson(String json, String appId,
                                                          Sensor sensor, String deviceTypeCode) {
            try {
                var root = om.readTree(json);
                if (root.has("raw") && root.get("raw").isObject()) {
                    root = root.get("raw");
                }
                var result = root.has("result") ? root.get("result") : root;
                var up = result.path("uplink_message");
                var endIds = result.path("end_device_ids");
                var rx0 = up.path("rx_metadata").isArray() && up.path("rx_metadata").size() > 0
                        ? up.path("rx_metadata").get(0) : null;
                var lora = up.path("settings").path("data_rate").path("lora");
                var netIds = up.path("network_ids");
                var dp = up.path("decoded_payload");
                if (dp.isMissingNode() || dp.isNull() || !dp.isObject()) {
                    return om.writeValueAsString(root);
                }

                String deviceId = textOr(endIds.path("device_id"), sensor.getIdSensor());
                String profile = deviceTypeCode != null ? deviceTypeCode.toUpperCase() : "GENERIC";

                var dto = com.amaris.sensorprocessor.entity.MonitoringSensorData.now();

                var ids = new com.amaris.sensorprocessor.entity.MonitoringSensorData.Ids();
                ids.setApplicationId(appId);
                ids.setDeviceId(deviceId);
                ids.setDevEui(textOr(endIds.path("dev_eui"), null));
                ids.setJoinEui(textOr(endIds.path("join_eui"), null));
                ids.setDevAddr(textOr(endIds.path("dev_addr"), null));
                ids.setProfile(profile);
                dto.setIds(ids);

                var link = new com.amaris.sensorprocessor.entity.MonitoringSensorData.LinkInfo();
                link.setFPort(intOrNull(up.path("f_port")));
                link.setFCnt(intOrNull(up.path("f_cnt")));
                if (rx0 != null) {
                    link.setGatewayId(textOr(rx0.path("gateway_ids").path("gateway_id"), null));
                    link.setRssi(numOrNull(rx0.has("rssi") ? rx0.path("rssi") : rx0.path("channel_rssi")));
                    link.setSnr(numOrNull(rx0.path("snr")));
                    link.setChannelIndex(intOrNull(rx0.path("channel_index")));
                    var loc = rx0.path("location");
                    if (!loc.isMissingNode()) {
                        var L = new com.amaris.sensorprocessor.entity.MonitoringSensorData.LinkInfo.Location();
                        L.setLatitude(numOrNull(loc.path("latitude")));
                        L.setLongitude(numOrNull(loc.path("longitude")));
                        L.setAltitude(intOrNull(loc.path("altitude")));
                        L.setSource(textOr(loc.path("source"), null));
                        link.setLocation(L);
                    }
                }
                Integer sf = intOrNull(lora.path("spreading_factor"));
                link.setSpreadingFactor(sf != null ? "SF" + sf : null);
                Integer bwHz = intOrNull(lora.path("bandwidth"));
                link.setBandwidthKhz(bwHz != null ? bwHz / 1000 : null);
                link.setCodingRate(textOr(lora.path("coding_rate"), null));
                Double fHz = numOrNull(up.path("settings").path("frequency"));
                link.setFrequencyMhz(fHz != null ? fHz / 1e6 : null);
                link.setConsumedAirtime(textOr(up.path("consumed_airtime"), null));
                dto.setLink(link);

                var payload = new com.amaris.sensorprocessor.entity.MonitoringSensorData.Payload();
                switch (profile) {
                    case "COUNT" -> {
                        payload.setBattery(firstNumber(dp, "battery"));
                        payload.setPeriodIn(firstNumber(dp, "period_in"));
                        payload.setPeriodOut(firstNumber(dp, "period_out"));
                    }
                    case "CO2" -> {
                        payload.setCo2Ppm(firstNumber(dp, "co2"));
                        payload.setTemperature(firstNumber(dp, "temperature"));
                        payload.setHumidity(firstNumber(dp, "humidity"));
                        payload.setVdd(firstNumber(dp, "vdd"));
                        payload.setLight(firstAny(dp, "light"));
                        payload.setPresence(firstAny(dp, "motion"));
                    }
                    case "OCCUP" -> {
                        payload.setPresence(firstAny(dp, "occupancy"));
                        payload.setDistance(firstNumber(dp, "distance"));
                        payload.setLight(firstAny(dp, "illuminance"));
                        payload.setBattery(firstNumber(dp, "battery"));
                    }
                    case "TEMPEX" -> {
                        payload.setTemperature(firstNumber(dp, "temperature"));
                        payload.setHumidity(firstNumber(dp, "humidity"));
                        payload.setBattery(firstNumber(dp, "battery"));
                    }
                    case "PIR_LIGHT" -> {
                        payload.setPresence(firstAny(dp, "pir"));
                        payload.setLight(firstAny(dp, "daylight"));
                        payload.setBattery(firstNumber(dp, "battery"));
                    }
                    case "EYE" -> {
                        payload.setTemperature(firstNumber(dp, "temperature"));
                        payload.setHumidity(firstNumber(dp, "humidity"));
                        payload.setLight(firstAny(dp, "light"));
                        Object motion = firstAny(dp, "motion");
                        Object occupancy = firstAny(dp, "occupancy");
                        payload.setPresence(motion != null ? motion : occupancy);
                        payload.setVdd(firstNumber(dp, "vdd"));
                    }
                    case "SON", "NOISE" -> {
                        payload.setLaiDb(firstNumber(dp, "LAI"));
                        payload.setLaiMaxDb(firstNumber(dp, "LAImax"));
                        payload.setLaeqDb(firstNumber(dp, "LAeq"));
                        payload.setBattery(firstNumber(dp, "battery"));
                    }
                    case "DESK" -> {
                        payload.setPresence(firstAny(dp, "occupancy"));
                        payload.setTemperature(firstNumber(dp, "temperature"));
                        payload.setHumidity(firstNumber(dp, "humidity"));
                        payload.setVdd(firstNumber(dp, "vdd"));
                        payload.setBattery(firstNumber(dp, "battery"));
                    }
                    case "ENERGY", "CONSO" -> {
                        if (dp != null && dp.isObject()) {
                            @SuppressWarnings("unchecked")
                            java.util.Map<String, Object> energyMap = om.convertValue(dp, java.util.Map.class);
                            payload.setEnergyData(energyMap);
                        }
                    }
                    default -> payload.setBattery(firstNumber(dp, "battery"));
                }
                dto.setPayload(payload);

                var net = new com.amaris.sensorprocessor.entity.MonitoringSensorData.NetworkInfo();
                net.setNetId(textOr(netIds.path("net_id"), null));
                net.setNsId(textOr(netIds.path("ns_id"), null));
                net.setTenantId(textOr(netIds.path("tenant_id"), null));
                net.setClusterId(textOr(netIds.path("cluster_id"), null));
                net.setClusterAddress(textOr(netIds.path("cluster_address"), null));
                dto.setNetwork(net);

                var raw = new com.amaris.sensorprocessor.entity.MonitoringSensorData.Raw();
                raw.setFrmPayloadBase64(textOr(up.path("frm_payload"), null));
                if (dp != null && dp.isObject()) {
                    raw.setDecodedPayload(om.convertValue(dp, java.util.Map.class));
                }
                dto.setRaw(raw);

                String receivedAt = textOr(result.path("received_at"), null);
                if (receivedAt == null) receivedAt = textOr(up.path("received_at"), null);
                if (receivedAt != null) dto.setTimestamp(receivedAt);

                return om.writeValueAsString(dto);
            } catch (Exception e) {
                return json;
            }
        }

        private static String textOr(com.fasterxml.jackson.databind.JsonNode n, String fallback) {
            return (n != null && n.isTextual()) ? n.asText() : fallback;
        }

        private static Integer intOrNull(com.fasterxml.jackson.databind.JsonNode n) {
            return (n != null && n.isNumber()) ? n.asInt() : null;
        }

        private static Double numOrNull(com.fasterxml.jackson.databind.JsonNode n) {
            if (n == null) return null;
            if (n.isNumber()) return n.asDouble();
            if (n.isTextual()) try {
                return Double.parseDouble(n.asText());
            } catch (Exception ignored) {
            }
            return null;
        }

        private static Object firstAny(com.fasterxml.jackson.databind.JsonNode dp, String key) {
            var n = dp.path(key);
            if (n.isMissingNode()) return null;
            if (n.isNumber()) return n.numberValue();
            if (n.isBoolean()) return n.booleanValue();
            if (n.isTextual()) return n.asText();
            return n.toString();
        }

        private static Double firstNumber(com.fasterxml.jackson.databind.JsonNode dp, String key) {
            var n = dp.path(key);
            if (n.isMissingNode()) return null;
            if (n.isNumber()) return n.asDouble();
            if (n.isTextual()) try {
                return Double.parseDouble(n.asText());
            } catch (Exception ignored) {
            }
            return null;
        }
    }
}
