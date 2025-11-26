package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.constant.Constants;
import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.amaris.sensorprocessor.entity.Gateway;
import com.amaris.sensorprocessor.entity.Sensor;
import com.amaris.sensorprocessor.entity.User;
import com.amaris.sensorprocessor.service.GatewayService;
import com.amaris.sensorprocessor.service.SensorService;
import com.amaris.sensorprocessor.service.UserService;
import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
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

    // Regex TTN pour device_id
    private static final Pattern DEVICE_ID_PATTERN = Pattern.compile("^[a-z0-9](?:[-]?[a-z0-9]){2,}$");
    private static final Pattern HEX16 = Pattern.compile("^[A-Fa-f0-9]{16}$");
    private static final Pattern HEX32 = Pattern.compile("^[A-Fa-f0-9]{32}$");

    private final SensorService sensorService;
    private final GatewayService gatewayService;
    private final UserService userService;
    private final com.amaris.sensorprocessor.service.SensorLorawanService sensorLorawanService;
    private final com.amaris.sensorprocessor.service.SensorSyncService sensorSyncService;

    @Autowired
    public SensorController(SensorService sensorService, GatewayService gatewayService, UserService userService,
                           com.amaris.sensorprocessor.service.SensorLorawanService sensorLorawanService,
                           com.amaris.sensorprocessor.service.SensorSyncService sensorSyncService) {
        this.sensorService = sensorService;
        this.gatewayService = gatewayService;
        this.userService = userService;
        this.sensorLorawanService = sensorLorawanService;
        this.sensorSyncService = sensorSyncService;
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

    /* ===================== ADD ===================== */

    @PostMapping("/manage-sensors/add")
    public String addSensor(@ModelAttribute(SENSOR_ADD) Sensor sensor,
                            BindingResult bindingResult,
                            Model model) {

        model.addAttribute(SENSOR_ADD, sensor);

        // device_id (TTN)
        if (isBlank(sensor.getIdSensor())) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "idSensor", "Sensor ID is required"));
        } else if (!DEVICE_ID_PATTERN.matcher(sensor.getIdSensor()).matches()) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "idSensor",
                    "Use lowercase a-z, 0-9 and single '-' (min 3 chars, no leading/trailing '-')"));
        }

        // Requis DB
        if (isBlank(sensor.getDeviceType())) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "deviceType", "Device Type is required"));
        }
        if (isBlank(sensor.getBuildingName())) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "buildingName", "Building Name is required"));
        }
        if (sensor.getFloor() == null) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "floor", "Floor is required"));
        }

        // Gateway obligatoire
        if (isBlank(sensor.getIdGateway())) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "idGateway", "Gateway is required"));
        }

        // DevEUI / JoinEUI / AppKey (OTAA)
        if (isBlank(sensor.getDevEui()) || !HEX16.matcher(sensor.getDevEui()).matches()) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "devEui", "DevEUI must be 16 hex characters"));
        }
        if (isBlank(sensor.getJoinEui()) || !HEX16.matcher(sensor.getJoinEui()).matches()) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "joinEui", "JoinEUI must be 16 hex characters"));
        }
        if (isBlank(sensor.getAppKey()) || !HEX32.matcher(sensor.getAppKey()).matches()) {
            bindingResult.addError(new FieldError(SENSOR_ADD, "appKey", "AppKey must be 32 hex characters"));
        }

        // Frequency plan : si vide, déduire de la gateway
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

    @GetMapping("/manage-sensors/monitoring/{idSensor}")
    public String monitorSensor(@PathVariable String idSensor, Model model, Principal principal, HttpSession session) {
        Sensor s = sensorService.getOrThrow(idSensor);
        model.addAttribute("sensor", s);

        gatewayService.findById(s.getIdGateway()).ifPresent(gw -> {
            String label = (gw.getBuildingName() != null && !gw.getBuildingName().isBlank())
                    ? gw.getBuildingName() + " (" + gw.getGatewayId() + ")"
                    : gw.getGatewayId();

            model.addAttribute("gatewayName", label);
            model.addAttribute("gatewayIp", gw.getIpAddress());
        });

        // --- Token SSE par session + capteur (évite les appels hors page)
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
    public String handleEditGet(@RequestParam(required = false) String idSensor, Model model, Principal principal) {
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

    /* ===================== DELETE ===================== */

    /**
     * Endpoint REST pour récupérer les sensors depuis TTN par gateway
     * GET /api/sensors/gateway/{gatewayId}/devices
     */
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

    /**
     * Endpoint REST pour synchroniser les sensors depuis TTN vers la DB
     * POST /api/sensors/gateway/{gatewayId}/sync
     */
    @PostMapping("/api/sensors/gateway/{gatewayId}/sync")
    @ResponseBody
    public String syncSensorsFromTTN(@PathVariable String gatewayId) {
        try {
            int syncCount = sensorSyncService.syncGateway(gatewayId);
            return "{\"success\":true,\"syncCount\":" + syncCount + ",\"message\":\"Synchronized " + syncCount + " sensors from TTN\"}";
        } catch (Exception e) {
            log.error("[API] Error syncing sensors for gateway {}: {}", gatewayId, e.getMessage());
            return "{\"success\":false,\"error\":\"" + e.getMessage() + "\"}";
        }
    }

    /**
     * Endpoint REST pour comparer les sensors DB vs TTN
     * GET /api/sensors/gateway/{gatewayId}/compare
     */
    @GetMapping("/api/sensors/gateway/{gatewayId}/compare")
    @ResponseBody
    public com.amaris.sensorprocessor.service.SensorSyncService.SyncReport compareSensorsWithTTN(@PathVariable String gatewayId) {
        return sensorSyncService.compareWithTTN(gatewayId);
    }

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

    @GetMapping(value = "/manage-sensors/monitoring/{idSensor}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamSensor(@PathVariable String idSensor,
                                   @RequestParam(name = "token") String token,
                                   HttpSession session) {
        // --- Vérif token SSE : empêche les appels “fantômes”
        String expected = (String) session.getAttribute("SSE_TOKEN__" + idSensor);
        if (expected == null || !expected.equals(token)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid SSE token");
        }

        Sensor sensor = sensorService.getOrThrow(idSensor);

        String appId = gatewayService.findById(sensor.getIdGateway())
                .map(Gateway::getGatewayId)
                .map(gid -> "leva-rpi-mantu".equalsIgnoreCase(gid) ? "lorawan-network-mantu" : gid + "-appli")
                .orElseThrow(() -> new IllegalStateException("Gateway introuvable pour le capteur " + idSensor));

        String threadId = "sensor-" + idSensor + "-" + session.getId() + "-" + System.currentTimeMillis();

        SseEmitter emitter = new SseEmitter(3600000L); // 1h

        emitter.onCompletion(() -> sensorService.stopMonitoring(idSensor, threadId));
        emitter.onTimeout(() -> {
            sensorService.stopMonitoring(idSensor, threadId);
            emitter.complete();
        });

        var normalizer = new SensorEventNormalizer();
        var subscription = sensorService.getMonitoringData(appId, idSensor, threadId)
                .map(json -> normalizer.normalizeToMonitoringSensorDataJson(json, appId, sensor))
                .subscribe(
                        normalizedJson -> {
                            try { emitter.send(normalizedJson); }
                            catch (IOException e) { emitter.completeWithError(e); }
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

    /**
     * Endpoint REST pour récupérer les données d'un capteur sur une période.
     */
    @GetMapping(value = "/manage-sensors/monitoring/{idGateway}/{idSensor}/{valueType}")
    @ResponseBody
    public LinkedHashMap<LocalDateTime, String> getSensorDataByPeriod(
            @PathVariable String idGateway, // Ca nous servira plus tard pour les idSensor ambigues
            @PathVariable String idSensor,
            @PathVariable PayloadValueType valueType,
            @RequestParam("startDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) Date startDate,
            @RequestParam("endDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) Date endDate) {
        try {
            return sensorService.findSensorDataByPeriodAndType(idSensor, startDate, endDate, valueType);
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
            @RequestParam("startDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) Date startDate,
            @RequestParam("endDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) Date endDate) {
        
        Map<PayloadValueType, LinkedHashMap<LocalDateTime, String>> dataGroupedByValueType = sensorService.findSensorDataByPeriod(idSensor, startDate, endDate);

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
        @RequestParam("startDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) Date startDate,
        @RequestParam("endDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) Date endDate,
        @RequestParam("channels") String[] channelsStr
    ) {
        // Append "CONSUMPTION_CHANNEL_" to all channelStr
        List<String> channels = new ArrayList<>();
        for (String channel : channelsStr) {
            channels.add("CONSUMPTION_CHANNEL_" + channel);
        }
        return sensorService.findSensorConsumptionByChannels(idSensor, startDate, endDate, channels);
    }
   

    /* ===================== PRIVÉS ===================== */

    private void prepareModel(Model model) {
        List<Sensor> sensors = sensorService.findAll();
        List<Gateway> gateways = gatewayService.getAllGateways();
        model.addAttribute("sensors", sensors);
        model.addAttribute("gateways", gateways);

        List<String> buildings = Stream.concat(
                        sensors.stream().map(Sensor::getBuildingName),
                        gateways.stream().map(Gateway::getBuildingName)
                )
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .sorted()
                .collect(Collectors.toList());

        model.addAttribute("buildings", buildings);

        if (!model.containsAttribute("sensorAdd")) {
            model.addAttribute("sensorAdd", new Sensor());
        }
    }

    private String redirectWithTimestamp() {
        return "redirect:/manage-sensors?_=" + System.currentTimeMillis();
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    // --- Normalizer simple & lisible (profil = deviceType) ---
    static class SensorEventNormalizer {
        private final com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();

        public String normalizeToMonitoringSensorDataJson(String json, String appId, Sensor sensor) {
            try {
                var root   = om.readTree(json);
                var result = root.has("result") ? root.get("result") : root;  // events vs storage
                var up     = result.path("uplink_message");
                var endIds = result.path("end_device_ids");
                var rx0    = up.path("rx_metadata").isArray() && up.path("rx_metadata").size() > 0
                        ? up.path("rx_metadata").get(0) : null;
                var lora   = up.path("settings").path("data_rate").path("lora");
                var netIds = up.path("network_ids");
                var dp     = up.path("decoded_payload");

                String deviceId = textOr(endIds.path("device_id"), sensor.getIdSensor());
                String profile  = sensor.getDeviceType() != null ? sensor.getDeviceType().toUpperCase() : "GENERIC";

                var dto = com.amaris.sensorprocessor.entity.MonitoringSensorData.now();

                // ids
                var ids = new com.amaris.sensorprocessor.entity.MonitoringSensorData.Ids();
                ids.setApplicationId(appId);
                ids.setDeviceId(deviceId);
                ids.setDevEui(textOr(endIds.path("dev_eui"), null));
                ids.setJoinEui(textOr(endIds.path("join_eui"), null));
                ids.setDevAddr(textOr(endIds.path("dev_addr"), null));
                ids.setProfile(profile);
                dto.setIds(ids);

                // link
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

                // payload — tri manuel par type
                var payload = new com.amaris.sensorprocessor.entity.MonitoringSensorData.Payload();
                switch (profile) {
                    case "COUNT" -> {
                        payload.setBattery(firstNumber(dp, "battery"));
                        payload.setPeriodIn(firstNumber(dp, "period_in"));
                        payload.setPeriodOut(firstNumber(dp, "period_out"));
                    }
                    case "CO2" -> {
                        payload.setCo2Ppm(firstNumber(dp, "co2"));           // 864
                        payload.setTemperature(firstNumber(dp, "temperature")); // 23.4
                        payload.setHumidity(firstNumber(dp, "humidity"));       // 41
                        payload.setVdd(firstNumber(dp, "vdd"));                 // 3677
                        payload.setLight(firstAny(dp, "light"));                // 99
                        Object motion = firstAny(dp, "motion");
                        payload.setPresence(motion);
                    }
                    case "OCCUP" -> {
                        payload.setPresence(firstAny(dp, "occupancy"));
                        // VS30 a 'distance', VS70 a 'illuminance'
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
                    case "SON" -> {
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
                    }
                    case "ENERGY", "CONSO" -> {
                        // Pour les capteurs d'énergie, on passe tout le decoded_payload
                        // car il contient la structure complexe avec les canaux
                        if (dp != null && dp.isObject()) {
                            @SuppressWarnings("unchecked")
                            java.util.Map<String, Object> energyMap = om.convertValue(dp, java.util.Map.class);
                            payload.setEnergyData(energyMap);
                        }
                        // Pas de battery pour CONSO car connecté à un générateur
                    }

                    default -> payload.setBattery(firstNumber(dp, "battery"));
                }
                dto.setPayload(payload);

                // network
                var net = new com.amaris.sensorprocessor.entity.MonitoringSensorData.NetworkInfo();
                net.setNetId(textOr(netIds.path("net_id"), null));
                net.setNsId(textOr(netIds.path("ns_id"), null));
                net.setTenantId(textOr(netIds.path("tenant_id"), null));
                net.setClusterId(textOr(netIds.path("cluster_id"), null));
                net.setClusterAddress(textOr(netIds.path("cluster_address"), null));
                dto.setNetwork(net);

                // raw (debug)
                var raw = new com.amaris.sensorprocessor.entity.MonitoringSensorData.Raw();
                raw.setFrmPayloadBase64(textOr(up.path("frm_payload"), null));
                if (dp != null && dp.isObject()) {
                    raw.setDecodedPayload(om.convertValue(dp, java.util.Map.class));
                }
                dto.setRaw(raw);

                // timestamp
                String receivedAt = textOr(result.path("received_at"), null);
                if (receivedAt == null) receivedAt = textOr(up.path("received_at"), null);
                if (receivedAt != null) dto.setTimestamp(receivedAt);

                return om.writeValueAsString(dto);
            } catch (Exception e) {
                return json; // ne casse pas l'UI si erreur
            }
        }

        /* -------- Helpers -------- */
        private static String textOr(com.fasterxml.jackson.databind.JsonNode n, String fallback) {
            return (n != null && n.isTextual()) ? n.asText() : fallback;
        }

        private static Integer intOrNull(com.fasterxml.jackson.databind.JsonNode n) {
            return (n != null && n.isNumber()) ? n.asInt() : null;
        }

        private static Double numOrNull(com.fasterxml.jackson.databind.JsonNode n) {
            if (n == null) return null;
            if (n.isNumber()) return n.asDouble();
            if (n.isTextual()) try { return Double.parseDouble(n.asText()); } catch (Exception ignored) {}
            return null;
        }

        private static Object firstAny(com.fasterxml.jackson.databind.JsonNode dp, String key) {
            var n = dp.path(key);
            if (n.isMissingNode()) return null;
            if (n.isNumber())  return n.numberValue();
            if (n.isBoolean()) return n.booleanValue();
            if (n.isTextual()) return n.asText();
            return n.toString();
        }

        private static Double firstNumber(com.fasterxml.jackson.databind.JsonNode dp, String key) {
            var n = dp.path(key);
            if (n.isMissingNode()) return null;
            if (n.isNumber()) return n.asDouble();
            if (n.isTextual()) try { return Double.parseDouble(n.asText()); } catch (Exception ignored) {}
            return null;
        }
    }
}
