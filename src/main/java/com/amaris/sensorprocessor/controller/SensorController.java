package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.constant.Constants;
import com.amaris.sensorprocessor.entity.Gateway;
import com.amaris.sensorprocessor.entity.Sensor;
import com.amaris.sensorprocessor.service.GatewayService;
import com.amaris.sensorprocessor.service.SensorService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.validation.ObjectError;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Slf4j
@Controller
public class SensorController {

    private static final String ERROR_ADD    = "errorAdd";
    private static final String SENSOR_ADD   = "sensorAdd";
    private static final String ERROR_EDIT   = "errorEdit";
    private static final String SENSOR_EDIT  = "sensorEdit";
    private static final String ERROR_DELETE = "errorDelete";

    // Regex TTN pour device_id
    private static final Pattern DEVICE_ID_PATTERN = Pattern.compile("^[a-z0-9](?:[-]?[a-z0-9]){2,}$");
    private static final Pattern HEX16 = Pattern.compile("^[A-Fa-f0-9]{16}$");
    private static final Pattern HEX32 = Pattern.compile("^[A-Fa-f0-9]{32}$");

    private final SensorService sensorService;
    private final GatewayService gatewayService;

    @Autowired
    public SensorController(SensorService sensorService, GatewayService gatewayService) {
        this.sensorService = sensorService;
        this.gatewayService = gatewayService;
    }

    /* ===================== LISTE ===================== */

    @GetMapping("/manage-sensors")
    public String manageSensors(Model model) {
        prepareModel(model);
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
    public String monitorSensor(@PathVariable String idSensor, Model model) {
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

        return "monitoringSensor"; // ou ta constante si tu en as une
    }


    @GetMapping("/manage-sensors/add")
    public String handleAddGet() {
        return redirectWithTimestamp();
    }

    /* ===================== EDIT ===================== */

    @GetMapping("/manage-sensors/edit/{idSensor}")
    public String editSensor(@PathVariable String idSensor, Model model) {
        prepareModel(model);
        try {
            Sensor sensor = sensorService.getOrThrow(idSensor);
            model.addAttribute(SENSOR_EDIT, sensor);
        } catch (Exception e) {
            model.addAttribute(SENSOR_EDIT, new Sensor());
            model.addAttribute(ERROR_EDIT, Constants.SENSOR_NOT_FOUND);
        }
        return Constants.PAGE_MANAGE_SENSORS;
    }

    @GetMapping("/manage-sensors/edit")
    public String handleEditGet(@RequestParam(required = false) String idSensor, Model model) {
        if (idSensor == null) return redirectWithTimestamp();
        return editSensor(idSensor, model);
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

    /* ===================== PRIVÉS ===================== */


    private void prepareModel(Model model) {
        List<Sensor> sensors  = sensorService.findAll();
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
}
