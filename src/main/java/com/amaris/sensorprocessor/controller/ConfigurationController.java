package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.config.AlertThresholdConfig;
import com.amaris.sensorprocessor.entity.*;
import com.amaris.sensorprocessor.repository.AlertConfigurationDao;
import com.amaris.sensorprocessor.repository.BuildingEnergyConfigDao;
import com.amaris.sensorprocessor.repository.SensorDao;
import com.amaris.sensorprocessor.service.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Controller
public class ConfigurationController {

    private final AlertThresholdConfig alertThresholdConfig;
    private final AlertConfigurationService alertConfigurationService;
    private final NotificationService notificationService;
    private final SensorThresholdService sensorThresholdService;
    private final UserService userService;
    private final SensorDao sensorDao;
    private final AlertConfigurationDao alertConfigurationDao;
    private final BrandService brandService;
    private final ProtocolService protocolService;
    private final DeviceTypeService deviceTypeService;
    private final BuildingEnergyConfigDao buildingEnergyConfigDao;
    private final SensorService sensorService;
    private final BuildingService buildingService;
    private final LocationService locationService;

    @Autowired
    public ConfigurationController(AlertThresholdConfig alertThresholdConfig,
                                   AlertConfigurationService alertConfigurationService,
                                   NotificationService notificationService,
                                   SensorThresholdService sensorThresholdService,
                                   UserService userService,
                                   SensorDao sensorDao,
                                   AlertConfigurationDao alertConfigurationDao,
                                   BrandService brandService,
                                   ProtocolService protocolService,
                                   DeviceTypeService deviceTypeService,
                                   SensorService sensorService,
                                   BuildingEnergyConfigDao buildingEnergyConfigDao,
                                   BuildingService buildingService,
                                   LocationService locationService) {
        this.alertThresholdConfig = alertThresholdConfig;
        this.alertConfigurationService = alertConfigurationService;
        this.notificationService = notificationService;
        this.sensorThresholdService = sensorThresholdService;
        this.userService = userService;
        this.sensorDao = sensorDao;
        this.alertConfigurationDao = alertConfigurationDao;
        this.brandService = brandService;
        this.protocolService = protocolService;
        this.deviceTypeService = deviceTypeService;
        this.sensorService = sensorService;
        this.buildingEnergyConfigDao = buildingEnergyConfigDao;
        this.buildingService = buildingService;
        this.locationService = locationService;
    }

    @GetMapping("/configuration")
    public String configuration(Model model, Principal principal) {
        model.addAttribute("alertConfig", alertThresholdConfig);
        model.addAttribute("deviceTypes", deviceTypeService.findAll());
        model.addAttribute("brands", brandService.findAll());
        model.addAttribute("protocols", protocolService.findAll());
        model.addAttribute("gatewayConfig", null);
        model.addAttribute("sensors", sensorDao.findAllSensors());
        model.addAttribute("buildings", buildingService.findAll());
        model.addAttribute("locations", locationService.findAll());

        if (principal != null) {
            User user = userService.searchUserByUsername(principal.getName());
            model.addAttribute("user", user);
            model.addAttribute("loggedUsername", user.getUsername());
        }

        return "configuration";
    }

    @GetMapping("/test-email")
    public String testEmail() {
        return "test-email";
    }

    @PostMapping("/api/configuration/alerts")
    @ResponseBody
    public ResponseEntity<?> updateAlertConfig(@RequestBody AlertThresholdConfig newConfig) {
        alertConfigurationService.saveConfig(newConfig);
        return ResponseEntity.ok().body(Map.of("message", "Configuration updated successfully"));
    }

    @PostMapping("/api/configuration/notifications")
    @ResponseBody
    public ResponseEntity<?> saveNotificationPreference(@RequestBody NotificationPreference preference, Principal principal) {
        if (principal != null) {
            preference.setUsername(principal.getName());
            notificationService.saveNotificationPreference(preference);
            return ResponseEntity.ok().body(Map.of("message", "Notification preference saved successfully"));
        }
        return ResponseEntity.badRequest().body(Map.of("error", "User not authenticated"));
    }

    @GetMapping("/api/configuration/notifications")
    @ResponseBody
    public ResponseEntity<?> getUserNotificationPreferences(Principal principal) {
        if (principal != null) {
            List<NotificationPreference> preferences = notificationService.getUserPreferences(principal.getName());
            return ResponseEntity.ok(preferences);
        }
        return ResponseEntity.badRequest().body(Map.of("error", "User not authenticated"));
    }

    @GetMapping("/api/configuration/notifications/{id}")
    @ResponseBody
    public ResponseEntity<?> getNotificationPreference(@PathVariable String id) {
        Optional<NotificationPreference> preference = notificationService.getPreferenceById(id);
        if (preference.isPresent()) {
            return ResponseEntity.ok(preference.get());
        }
        return ResponseEntity.notFound().build();
    }

    @DeleteMapping("/api/configuration/notifications/{id}")
    @ResponseBody
    public ResponseEntity<?> deleteNotificationPreference(@PathVariable String id) {
        notificationService.deletePreference(id);
        return ResponseEntity.ok().body(Map.of("message", "Notification preference deleted successfully"));
    }

    @PostMapping("/api/configuration/sensor-thresholds")
    @ResponseBody
    public ResponseEntity<?> saveSensorThreshold(@RequestBody SensorThreshold threshold) {
        sensorThresholdService.saveThreshold(threshold);
        return ResponseEntity.ok().body(Map.of("message", "Sensor threshold saved successfully"));
    }

    @GetMapping("/api/configuration/sensor-thresholds")
    @ResponseBody
    public ResponseEntity<?> getAllSensorThresholds() {
        List<SensorThreshold> thresholds = sensorThresholdService.getAllThresholds();
        return ResponseEntity.ok(thresholds);
    }

    @GetMapping("/api/configuration/sensor-thresholds/{id}")
    @ResponseBody
    public ResponseEntity<?> getSensorThreshold(@PathVariable String id) {
        Optional<SensorThreshold> threshold = sensorThresholdService.getThresholdById(id);
        if (threshold.isPresent()) {
            return ResponseEntity.ok(threshold.get());
        }
        return ResponseEntity.notFound().build();
    }

    @DeleteMapping("/api/configuration/sensor-thresholds/{id}")
    @ResponseBody
    public ResponseEntity<?> deleteSensorThreshold(@PathVariable String id) {
        sensorThresholdService.deleteThreshold(id);
        return ResponseEntity.ok().body(Map.of("message", "Sensor threshold deleted successfully"));
    }

    @GetMapping("/api/configuration/sensor-thresholds/sensor/{sensorId}")
    @ResponseBody
    public ResponseEntity<?> getSensorThresholds(@PathVariable String sensorId) {
        List<SensorThreshold> thresholds = sensorThresholdService.getThresholdsForSensor(sensorId);
        return ResponseEntity.ok(thresholds);
    }

    @GetMapping("/api/configuration/sensors")
    @ResponseBody
    public ResponseEntity<?> getAllSensors() {
        List<Sensor> sensors = sensorDao.findAllSensors();
        return ResponseEntity.ok(sensors);
    }

    @GetMapping("/api/configuration/alert-config")
    @ResponseBody
    public AlertConfigEntity getAlertConfig() {
        AlertConfigEntity config = alertConfigurationDao.load();
        return config != null ? config : new AlertConfigEntity();
    }

    @PostMapping("/configuration/brands/add")
    public String addBrand(@RequestParam("name") String name, Model model, Principal principal) {
        try {
            brandService.createByName(name);
            model.addAttribute("configMessage", "Brand added successfully");
        } catch (Exception e) {
            model.addAttribute("configError", e.getMessage());
        }
        return configuration(model, principal);
    }

    @PostMapping("/configuration/protocols/add")
    public String addProtocol(@RequestParam("name") String name,
                              @RequestParam(value = "available", required = false) Boolean available,
                              Model model, Principal principal) {
        try {
            protocolService.createByName(name, available);
            model.addAttribute("configMessage", "Protocol added successfully");
        } catch (Exception e) {
            model.addAttribute("configError", e.getMessage());
        }
        return configuration(model, principal);
    }

    @PostMapping("/configuration/sensors/add")
    public String addSensor(@ModelAttribute Sensor sensor, Model model, Principal principal) {
        try {
            sensorService.create(sensor);
            model.addAttribute("configMessage", "Sensor created successfully");
        } catch (Exception e) {
            model.addAttribute("configError", e.getMessage());
        }
        return configuration(model, principal);
    }

    @PostMapping("/configuration/brands/delete")
    public String deleteBrand(@RequestParam("id") Integer id, Model model, Principal principal) {
        try {
            brandService.deleteById(id);
            model.addAttribute("configMessage", "Brand deleted successfully");
        } catch (Exception e) {
            model.addAttribute("configError", e.getMessage());
        }
        return configuration(model, principal);
    }

    @PostMapping("/configuration/device-types/add")
    public String addDeviceType(@RequestParam("name") String name, Model model, Principal principal) {
        try {
            deviceTypeService.createByLabel(name.toUpperCase());
            model.addAttribute("configMessage", "Device type added successfully");
        } catch (Exception e) {
            model.addAttribute("configError", e.getMessage());
        }
        return configuration(model, principal);
    }

    @PostMapping("/configuration/device-types/delete")
    public String deleteDeviceType(@RequestParam("id") Integer id, Model model, Principal principal) {
        try {
            deviceTypeService.deleteById(id);
            model.addAttribute("configMessage", "Device type deleted successfully");
        } catch (Exception e) {
            model.addAttribute("configError", e.getMessage());
        }
        return configuration(model, principal);
    }

    @PostMapping("/configuration/protocols/delete")
    public String deleteProtocol(@RequestParam("id") Integer id, Model model, Principal principal) {
        try {
            protocolService.deleteById(id);
            model.addAttribute("configMessage", "Protocol deleted successfully");
        } catch (Exception e) {
            model.addAttribute("configError", e.getMessage());
        }
        return configuration(model, principal);
    }

    // ==================== BUILDING ENERGY CONFIG ====================

    @GetMapping("/api/configuration/building-energy")
    @ResponseBody
    public ResponseEntity<?> getAllBuildingEnergyConfigs() {
        List<BuildingEnergyConfig> configs = buildingEnergyConfigDao.findAll();
        return ResponseEntity.ok(configs);
    }

    @GetMapping("/api/configuration/building-energy/{buildingId}")
    @ResponseBody
    public ResponseEntity<?> getBuildingEnergyConfig(@PathVariable Integer buildingId) {
        Optional<BuildingEnergyConfig> config = buildingEnergyConfigDao.findByBuildingId(buildingId);
        if (config.isPresent()) {
            return ResponseEntity.ok(config.get());
        }
        BuildingEnergyConfig defaultConfig = new BuildingEnergyConfig();
        defaultConfig.setBuildingId(buildingId);
        defaultConfig.setEnergyCostPerKwh(0.0);
        defaultConfig.setCurrency("EUR");
        defaultConfig.setCo2EmissionFactor(0.0);
        return ResponseEntity.ok(defaultConfig);
    }

    @PostMapping("/api/configuration/building-energy")
    @ResponseBody
    public ResponseEntity<?> saveBuildingEnergyConfig(@RequestBody BuildingEnergyConfig config) {
        if (config.getBuildingId() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Building ID is required"));
        }
        if (config.getEnergyCostPerKwh() == null || config.getEnergyCostPerKwh() < 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Energy cost must be a positive number"));
        }
        buildingEnergyConfigDao.save(config);
        return ResponseEntity.ok().body(Map.of("message", "Building energy configuration saved successfully"));
    }

    @DeleteMapping("/api/configuration/building-energy/{buildingId}")
    @ResponseBody
    public ResponseEntity<?> deleteBuildingEnergyConfig(@PathVariable Integer buildingId) {
        buildingEnergyConfigDao.delete(buildingId);
        return ResponseEntity.ok().body(Map.of("message", "Building energy configuration deleted successfully"));
    }

    @GetMapping("/configuration/brands/{id}/decoder")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getDecoder(@PathVariable Integer id) {
        String decoder = brandService.getDecoder(id);
        return ResponseEntity.ok(Map.of("decoder", decoder != null ? decoder : ""));
    }


    @PostMapping("/configuration/brands/{id}/decoder")
    @ResponseBody
    public ResponseEntity<String> saveDecoder(@PathVariable Integer id,
                                              @RequestBody Map<String, String> body) {
        brandService.updateDecoder(id, body.get("decoder"));
        return ResponseEntity.ok("{\"success\":true}");
    }

    // ==================== LOCATIONS ====================

    @PostMapping("/configuration/locations/add")
    public String addLocation(@RequestParam("name") String name,
                              @RequestParam("buildingId") Integer buildingId,
                              Model model, Principal principal) {
        try {
            Location location = new Location();
            location.setName(name);
            location.setBuildingId(buildingId);
            locationService.create(location);
            model.addAttribute("configMessage", "Location added successfully");
        } catch (Exception e) {
            model.addAttribute("configError", e.getMessage());
        }
        return configuration(model, principal);
    }

    @PostMapping("/configuration/locations/delete")
    public String deleteLocation(@RequestParam("id") Integer id, Model model, Principal principal) {
        try {
            locationService.delete(id);
            model.addAttribute("configMessage", "Location deleted successfully");
        } catch (Exception e) {
            model.addAttribute("configError", e.getMessage());
        }
        return configuration(model, principal);
    }

    @PostMapping("/configuration/brands/test-decoder")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> testDecoder(@RequestBody Map<String, String> body) {
        String decoder = body.get("decoder");
        String hexPayload = body.get("payload");
        int fPort = 1; // valeur par défaut
        try {
            fPort = Integer.parseInt(body.getOrDefault("fport", "1"));
        } catch (NumberFormatException ignored) {}

        try {
            String result = brandService.testDecoder(decoder, hexPayload, fPort);
            return ResponseEntity.ok(Map.of("success", true, "result", result));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("success", false, "error", e.getMessage()));
        }
    }



}
