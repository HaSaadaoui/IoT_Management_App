package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.constant.Constants;
import com.amaris.sensorprocessor.entity.Gateway;
import com.amaris.sensorprocessor.entity.Sensor;
import com.amaris.sensorprocessor.entity.User;
import com.amaris.sensorprocessor.service.GatewayService;
import com.amaris.sensorprocessor.service.SensorService;
import com.amaris.sensorprocessor.service.UserService;
import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.validation.ObjectError;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.security.Principal;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
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

    @Autowired
    public SensorController(SensorService sensorService, GatewayService gatewayService, UserService userService) {
        this.sensorService = sensorService;
        this.gatewayService = gatewayService;
        this.userService = userService;
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

        // On garde l'objet soumis
        model.addAttribute(SENSOR_ADD, sensor);

        // -------- Validations (comme manage-gateways) --------

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

        // Gateway obligatoire (sinon pas d’app TTN ni de FP)
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

        // Frequency plan : si vide, le déduire de la gateway sélectionnée
        if (isBlank(sensor.getFrequencyPlan()) && !isBlank(sensor.getIdGateway())) {
            Optional<Gateway> gw = gatewayService.findById(sensor.getIdGateway());
            gw.ifPresent(g -> sensor.setFrequencyPlan(g.getFrequencyPlan()));
        }

        // Si erreurs → on renvoie la page avec le binding (comme gateways)
        if (bindingResult.hasErrors()) {
            prepareModel(model);
            model.addAttribute(Constants.BINDING_SENSOR_ADD, bindingResult);
            model.addAttribute(ERROR_ADD, Constants.INPUT_ERROR);
            return Constants.PAGE_MANAGE_SENSORS;
        }

        // -------- Service
        try {
            sensorService.create(sensor);
        } catch (IllegalArgumentException | IllegalStateException e) {
            // exemple : "idSensor already exists", etc.
            bindingResult.addError(new FieldError(SENSOR_ADD, "idSensor", e.getMessage()));
            prepareModel(model);
            model.addAttribute(Constants.BINDING_SENSOR_ADD, bindingResult);
            model.addAttribute(ERROR_ADD, e.getMessage());
            return Constants.PAGE_MANAGE_SENSORS;
        } catch (Exception e) {
            // ex: erreur TTN/DB générique
            log.error("[Sensors] Add failed", e);
            prepareModel(model);
            model.addAttribute(ERROR_ADD, Constants.DATABASE_PROBLEM);
            return Constants.PAGE_MANAGE_SENSORS;
        }

        model.addAttribute(ERROR_ADD, null);
        return redirectWithTimestamp();
    }

    @GetMapping("/manage-sensors/monitoring/{idSensor}")
    public String monitorSensor(@PathVariable String idSensor, Model model, Principal principal) {
        Sensor s = sensorService.getOrThrow(idSensor);
        model.addAttribute("sensor", s);

        gatewayService.findById(s.getIdGateway()).ifPresent(gw -> {
            // Label par défaut = gatewayId ; tu peux le rendre plus parlant si tu as un buildingName
            String label = (gw.getBuildingName() != null && !gw.getBuildingName().isBlank())
                    ? gw.getBuildingName() + " (" + gw.getGatewayId() + ")"
                    : gw.getGatewayId();

            model.addAttribute("gatewayName", label);          // <-- remplace l'ancien getGatewayName()
            model.addAttribute("gatewayIp", gw.getIpAddress()); // <-- remplace ipLocal/ipPublic
        });
        User user = userService.searchUserByUsername(principal.getName());
        model.addAttribute("user", user);
        model.addAttribute("loggedUsername", user.getUsername());
        return "monitoringSensor"; // ou ta constante si tu en as une
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
    public SseEmitter streamSensor(@PathVariable String idSensor, HttpSession session) {
        // 1) Récupère le capteur
        Sensor sensor = sensorService.getOrThrow(idSensor);

        // 2) Déduis l'app TTN à partir de la gateway (règle par défaut + cas particulier)
        String appId = gatewayService.findById(sensor.getIdGateway())
                .map(Gateway::getGatewayId)
                .map(gid -> "leva-rpi-mantu".equals(gid) ? "lorawan-network-mantu" : gid + "-appli")
                .orElseThrow(() -> new IllegalStateException("Gateway introuvable pour le capteur " + idSensor));

        // 3) Thread unique par client
        String threadId = "sensor-" + idSensor + "-" + session.getId() + "-" + System.currentTimeMillis();

        // 4) Emitter SSE côté MVC
        SseEmitter emitter = new SseEmitter(3600000L);

        emitter.onCompletion(() -> sensorService.stopMonitoring(idSensor, threadId));
        emitter.onTimeout(() -> {
            sensorService.stopMonitoring(idSensor, threadId);
            emitter.complete();
        });

        // 5) Abonnement au Flux<String> retourné par le microservice (8081), puis normalisation -> MonitoringSensorData
        var normalizer = new SensorEventNormalizer();
        var subscription = sensorService.getMonitoringData(appId, idSensor, threadId)
                .map(json -> normalizer.normalizeToMonitoringSensorDataJson(json, appId, sensor))
                .subscribe(
                        normalizedJson -> {
                            try {
                                emitter.send(normalizedJson);
                            } catch (IOException e) {
                                emitter.completeWithError(e);
                            }
                        },
                        emitter::completeWithError,
                        emitter::complete
                );

        // 6) Nettoyage
        emitter.onCompletion(subscription::dispose);
        emitter.onTimeout(subscription::dispose);

        return emitter;
    }



    /* ===================== PRIVÉS ===================== */


    private void prepareModel(Model model) {
        List<Sensor> sensors = sensorService.findAll();
        List<Gateway> gateways = gatewayService.getAllGateways();
        model.addAttribute("sensors", sensors);
        model.addAttribute("gateways", gateways);

        // Liste unique et triée des noms de bâtiments (strings simples)
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

    // --- Utilitaire minimal de normalisation (inline pour simplicité) ---
    static class SensorEventNormalizer {
        private final com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();

        @SuppressWarnings("unchecked")
        public String normalizeToMonitoringSensorDataJson(String json, String appId, Sensor sensor) {
            try {
                var root = om.readValue(json, java.util.Map.class);
                // TTN "events" mettent l'objet dans result ; storage uplink le met directement
                var result = (java.util.Map<String, Object>) root.getOrDefault("result", root);
                var up = (java.util.Map<String, Object>) result.getOrDefault("uplink_message", java.util.Map.of());
                var rx = (java.util.List<java.util.Map<String, Object>>) up.getOrDefault("rx_metadata", java.util.List.of());
                var rx0 = rx.isEmpty() ? java.util.Map.<String, Object>of() : rx.get(0);
                var gwIds = (java.util.Map<String, Object>) ((java.util.Map<String, Object>) rx0.getOrDefault("gateway_ids", java.util.Map.of()));
                var settings = (java.util.Map<String, Object>) up.getOrDefault("settings", java.util.Map.of());
                var dataRate = (java.util.Map<String, Object>) settings.getOrDefault("data_rate", java.util.Map.of());
                var lora = (java.util.Map<String, Object>) dataRate.getOrDefault("lora", java.util.Map.of());
                var network = (java.util.Map<String, Object>) result.getOrDefault("network_ids", java.util.Map.of());
                var endIds = (java.util.Map<String, Object>) result.getOrDefault("end_device_ids", java.util.Map.of());

                // decoded_payload : objet OU string concaténée → parse
                Object decodedPayloadRaw = up.get("decoded_payload");
                java.util.Map<String, Object> dp = parseDecodedPayload(decodedPayloadRaw);

                // Profil par contenu puis fallback deviceType
                String profile = detectProfile(dp, sensor.getDeviceType());

                // Construire DTO
                var dto = com.amaris.sensorprocessor.entity.MonitoringSensorData.now();

                // ids
                var ids = new com.amaris.sensorprocessor.entity.MonitoringSensorData.Ids();
                ids.setApplicationId(appId);
                ids.setDeviceId(String.valueOf(endIds.getOrDefault("device_id", sensor.getIdSensor())));
                ids.setDevEui((String) endIds.get("dev_eui"));
                ids.setJoinEui((String) endIds.get("join_eui"));
                ids.setDevAddr((String) endIds.get("dev_addr"));
                ids.setProfile(profile);
                dto.setIds(ids);

                // link
                var link = new com.amaris.sensorprocessor.entity.MonitoringSensorData.LinkInfo();
                link.setFPort(nInt(up.get("f_port")));
                link.setFCnt(nInt(up.get("f_cnt")));
                link.setGatewayId((String) gwIds.get("gateway_id"));
                link.setRssi(nDbl(rx0.get("rssi") != null ? rx0.get("rssi") : rx0.get("channel_rssi")));
                link.setSnr(nDbl(rx0.get("snr")));
                Integer sf = nInt(lora.get("spreading_factor"));
                link.setSpreadingFactor(sf != null ? "SF" + sf : null);
                Integer bw = nInt(lora.get("bandwidth"));
                link.setBandwidthKhz(bw != null ? (int) Math.round(bw / 1000.0) : null);
                link.setCodingRate((String) lora.get("coding_rate"));
                Double fHz = nDbl(settings.get("frequency"));
                link.setFrequencyMhz(fHz != null ? fHz / 1e6 : null);
                link.setConsumedAirtime((String) up.get("consumed_airtime"));
                link.setChannelIndex(nInt(rx0.get("channel_index")));
                // location
                var locRaw = (java.util.Map<String, Object>) rx0.get("location");
                if (locRaw != null) {
                    var loc = new com.amaris.sensorprocessor.entity.MonitoringSensorData.LinkInfo.Location();
                    loc.setLatitude(nDbl(locRaw.get("latitude")));
                    loc.setLongitude(nDbl(locRaw.get("longitude")));
                    loc.setAltitude(nInt(locRaw.get("altitude")));
                    loc.setSource((String) locRaw.get("source"));
                    link.setLocation(loc);
                }
                dto.setLink(link);

                // payload normalisé
                var payload = new com.amaris.sensorprocessor.entity.MonitoringSensorData.Payload();
                // presence (occupancy ou pir si présent)
                if (dp.containsKey("occupancy")) payload.setPresence(dp.get("occupancy"));
                else if (dp.containsKey("pir")) payload.setPresence(dp.get("pir"));

                // light (illuminance ou daylight)
                if (dp.containsKey("illuminance")) payload.setLight(dp.get("illuminance"));
                else if (dp.containsKey("daylight")) payload.setLight(dp.get("daylight"));

                // battery
                Double batt = nDbl(dp.get("battery"));
                if (batt == null) {
                    var lastBatt = (java.util.Map<String, Object>) up.get("last_battery_percentage");
                    if (lastBatt != null) batt = nDbl(lastBatt.get("value"));
                }
                payload.setBattery(batt);

                // temp/hum/vdd (desk/text)
                payload.setTemperature(nDbl(dp.get("temperature")));
                payload.setHumidity(nDbl(dp.get("humidity")));
                payload.setVdd(nDbl(dp.get("vdd")));
                dto.setPayload(payload);

                // network
                var net = new com.amaris.sensorprocessor.entity.MonitoringSensorData.NetworkInfo();
                net.setNetId((String) network.get("net_id"));
                net.setNsId((String) network.get("ns_id"));
                net.setTenantId((String) network.get("tenant_id"));
                net.setClusterId((String) network.get("cluster_id"));
                net.setClusterAddress((String) network.get("cluster_address"));
                dto.setNetwork(net);

                // raw pour debug minimal
                var raw = new com.amaris.sensorprocessor.entity.MonitoringSensorData.Raw();
                raw.setDecodedPayload(dp);
                raw.setFrmPayloadBase64((String) up.get("frm_payload"));
                dto.setRaw(raw);

                // timestamp (received_at event ou uplink)
                String receivedAt = (String) (result.get("received_at") != null ? result.get("received_at") : up.get("received_at"));
                dto.setTimestamp(receivedAt != null ? receivedAt : dto.getTimestamp());

                return om.writeValueAsString(dto);
            } catch (Exception e) {
                // en cas de souci, on renvoie tel quel (pour ne pas casser l'affichage)
                return json;
            }
        }

        private static Integer nInt(Object o) {
            if (o instanceof Number n) return n.intValue();
            if (o instanceof String s) try {
                return Integer.parseInt(s);
            } catch (Exception ignored) {
            }
            return null;
        }

        private static Double nDbl(Object o) {
            if (o instanceof Number n) return n.doubleValue();
            if (o instanceof String s) try {
                return Double.parseDouble(s);
            } catch (Exception ignored) {
            }
            return null;
        }

        @SuppressWarnings("unchecked")
        private static java.util.Map<String, Object> parseDecodedPayload(Object raw) {
            if (raw == null) return new java.util.LinkedHashMap<>();
            if (raw instanceof java.util.Map) return new java.util.LinkedHashMap<>((java.util.Map<String, Object>) raw);
            if (raw instanceof String s) {
                var m = new java.util.LinkedHashMap<String, Object>();
                var re = java.util.regex.Pattern.compile("([A-Za-z_]+)\\s*[:=]?\\s*([+-]?\\d+(?:\\.\\d+)?)");
                var x = re.matcher(s);
                while (x.find()) {
                    var key = x.group(1).toLowerCase();
                    var val = x.group(2);
                    try {
                        m.put(key, val.contains(".") ? Double.parseDouble(val) : Integer.parseInt(val));
                    } catch (NumberFormatException nfe) {
                        m.put(key, val);
                    }
                }
                return m;
            }
            // fallback best-effort
            return new java.util.LinkedHashMap<>();
        }

        private static String detectProfile(java.util.Map<String, Object> dp, String deviceType) {
            if (dp.containsKey("occupancy") || dp.containsKey("illuminance")) return "VS70_OCCUPANCY";
            if (dp.containsKey("pir") || dp.containsKey("daylight")) return "PIR_LIGHT";
            if (dp.containsKey("temperature") || dp.containsKey("humidity") || dp.containsKey("vdd"))
                return "DESK_TEXT";
            if (deviceType != null) {
                var dt = deviceType.toLowerCase();
                if (dt.contains("occupancy")) return "VS70_OCCUPANCY";
                if (dt.contains("pir")) return "PIR_LIGHT";
                if (dt.contains("desk")) return "DESK_TEXT";
            }
            return "GENERIC";
        }
    }
}


