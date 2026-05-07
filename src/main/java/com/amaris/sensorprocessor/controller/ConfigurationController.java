package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.config.AlertThresholdConfig;
import com.amaris.sensorprocessor.entity.*;
import com.amaris.sensorprocessor.repository.AlertConfigurationDao;
import com.amaris.sensorprocessor.repository.BuildingEnergyConfigDao;
import com.amaris.sensorprocessor.repository.GatewayDao;
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
    private final GatewayDao gatewayDao;
    private final AlertConfigurationDao alertConfigurationDao;
    private final BrandService brandService;
    private final ProtocolService protocolService;
    private final DeviceTypeService deviceTypeService;
    private final BuildingEnergyConfigDao buildingEnergyConfigDao;
    private final SensorService sensorService;
    private final BuildingService buildingService;
    private final LocationService locationService;
    private final GatewayRebootSchedulerService gatewayRebootSchedulerService;
    private final DatabaseConnectionConfigService databaseConnectionConfigService;
    private final ApplicationRestartService applicationRestartService;

    @Autowired
    public ConfigurationController(AlertThresholdConfig alertThresholdConfig,
                                   AlertConfigurationService alertConfigurationService,
                                   NotificationService notificationService,
                                   SensorThresholdService sensorThresholdService,
                                   UserService userService,
                                   SensorDao sensorDao,
                                   GatewayDao gatewayDao,
                                   AlertConfigurationDao alertConfigurationDao,
                                   BrandService brandService,
                                   ProtocolService protocolService,
                                   DeviceTypeService deviceTypeService,
                                   SensorService sensorService,
                                   BuildingEnergyConfigDao buildingEnergyConfigDao,
                                   BuildingService buildingService,
                                   LocationService locationService,
                                   GatewayRebootSchedulerService gatewayRebootSchedulerService,
                                   DatabaseConnectionConfigService databaseConnectionConfigService,
                                   ApplicationRestartService applicationRestartService) {
        this.alertThresholdConfig = alertThresholdConfig;
        this.alertConfigurationService = alertConfigurationService;
        this.notificationService = notificationService;
        this.sensorThresholdService = sensorThresholdService;
        this.userService = userService;
        this.sensorDao = sensorDao;
        this.gatewayDao = gatewayDao;
        this.alertConfigurationDao = alertConfigurationDao;
        this.brandService = brandService;
        this.protocolService = protocolService;
        this.deviceTypeService = deviceTypeService;
        this.sensorService = sensorService;
        this.buildingEnergyConfigDao = buildingEnergyConfigDao;
        this.buildingService = buildingService;
        this.locationService = locationService;
        this.gatewayRebootSchedulerService = gatewayRebootSchedulerService;
        this.databaseConnectionConfigService = databaseConnectionConfigService;
        this.applicationRestartService = applicationRestartService;
    }

    @GetMapping("/configuration")
    public String configuration(Model model, Principal principal) {
        model.addAttribute("alertConfig", alertThresholdConfig);
        model.addAttribute("deviceTypes", deviceTypeService.findAll());
        model.addAttribute("brands", brandService.findAll());
        model.addAttribute("protocols", protocolService.findAll());
        model.addAttribute("gatewayConfig", null);
        model.addAttribute("sensors", sensorDao.findAllSensors());
        model.addAttribute("gateways", gatewayDao.findAllGateways());
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

    @GetMapping("/api/configuration/gateway-reboots")
    @ResponseBody
    public ResponseEntity<?> getGatewayRebootSchedules() {
        return ResponseEntity.ok(gatewayRebootSchedulerService.findAllGatewaySchedules());
    }

    @PostMapping("/api/configuration/gateway-reboots/{gatewayId}/restart")
    @ResponseBody
    public ResponseEntity<?> restartGatewayFromConfiguration(@PathVariable String gatewayId) {
        try {
            String message = gatewayRebootSchedulerService.restartNow(gatewayId);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", message == null || message.isBlank() ? "Restart requested" : message
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Error restarting gateway"));
        }
    }

    @PostMapping("/api/configuration/gateway-reboots/{gatewayId}/schedule")
    @ResponseBody
    public ResponseEntity<?> saveGatewayRebootSchedule(@PathVariable String gatewayId,
                                                       @RequestBody Map<String, Object> body) {
        try {
            boolean enabled = Boolean.parseBoolean(String.valueOf(body.getOrDefault("enabled", false)));
            int intervalMinutes = Integer.parseInt(String.valueOf(body.getOrDefault("intervalMinutes", 1440)));
            return ResponseEntity.ok(gatewayRebootSchedulerService.saveSchedule(gatewayId, enabled, intervalMinutes));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Error saving gateway reboot schedule"));
        }
    }

    @GetMapping("/api/configuration/database")
    @ResponseBody
    public ResponseEntity<?> getDatabaseConfiguration() {
        return ResponseEntity.ok(databaseConnectionConfigService.getCurrentConfig());
    }

    @PostMapping("/api/configuration/database/test")
    @ResponseBody
    public ResponseEntity<?> testDatabaseConfiguration(@RequestBody DatabaseConnectionConfig config) {
        try {
            return ResponseEntity.ok(databaseConnectionConfigService.testConnection(config));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/api/configuration/database/save")
    @ResponseBody
    public ResponseEntity<?> saveDatabaseConfiguration(@RequestBody DatabaseConnectionConfig config) {
        try {
            Map<String, Object> result = databaseConnectionConfigService.saveConfig(config);
            boolean success = Boolean.TRUE.equals(result.get("success"));
            return success ? ResponseEntity.ok(result) : ResponseEntity.badRequest().body(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", "Unable to save database configuration"));
        }
    }

    @PostMapping("/api/configuration/application/restart")
    @ResponseBody
    public ResponseEntity<?> restartApplication() {
        applicationRestartService.restart();
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Application restart requested"
        ));
    }

    @PostMapping("/configuration/brands/add")
    @ResponseBody
    public ResponseEntity<?> addBrand(@RequestParam("name") String name) {
        try {
            brandService.createByName(name);
            return ResponseEntity.ok(Map.of("message", "Brand added successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/configuration/protocols/add")
    @ResponseBody
    public ResponseEntity<?> addProtocol(@RequestParam("name") String name,
                                         @RequestParam(value = "available", required = false) Boolean available) {
        try {
            protocolService.createByName(name, available);
            return ResponseEntity.ok(Map.of("message", "Protocol added successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
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
    @ResponseBody
    public ResponseEntity<?> deleteBrand(@RequestParam("id") Integer id) {
        try {
            brandService.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Brand deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/configuration/device-types/add")
    @ResponseBody
    public ResponseEntity<?> addDeviceType(@RequestParam("name") String name) {
        try {
            deviceTypeService.createByLabel(name.toUpperCase());
            return ResponseEntity.ok(Map.of("message", "Device type added successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/configuration/device-types/delete")
    @ResponseBody
    public ResponseEntity<?> deleteDeviceType(@RequestParam("id") Integer id) {
        try {
            deviceTypeService.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Device type deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/configuration/protocols/delete")
    @ResponseBody
    public ResponseEntity<?> deleteProtocol(@RequestParam("id") Integer id) {
        try {
            protocolService.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Protocol deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
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
                              @RequestParam("buildingId") Integer buildingId) {
        Location location = new Location();
        location.setName(name);
        location.setBuildingId(buildingId);
        locationService.create(location);
        return "redirect:/configuration#section-locations";
    }

    @PostMapping("/configuration/locations/delete")
    public String deleteLocation(@RequestParam("id") Integer id) {
        locationService.delete(id);
        return "redirect:/configuration#section-locations";
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

    // ==================== CHECK-DELETE ====================

    @GetMapping("/api/configuration/brands/{id}/check-delete")
    @ResponseBody
    public ResponseEntity<?> checkDeleteBrand(@PathVariable Integer id) {
        List<Sensor> sensors = sensorDao.findAllByBrandId(id);
        boolean canDelete = sensors.isEmpty();
        return ResponseEntity.ok(Map.of("canDelete", canDelete, "sensors", sensors, "gateways", List.of()));
    }

    @GetMapping("/api/configuration/device-types/{id}/check-delete")
    @ResponseBody
    public ResponseEntity<?> checkDeleteDeviceType(@PathVariable Integer id) {
        List<Sensor> sensors = sensorDao.findAllByDeviceTypeId(id);
        boolean canDelete = sensors.isEmpty();
        return ResponseEntity.ok(Map.of("canDelete", canDelete, "sensors", sensors, "gateways", List.of()));
    }

    @GetMapping("/api/configuration/protocols/{id}/check-delete")
    @ResponseBody
    public ResponseEntity<?> checkDeleteProtocol(@PathVariable Integer id) {
        List<Sensor> sensors = sensorDao.findAllByProtocolId(id);
        List<Gateway> gateways = gatewayDao.findByProtocolId(id);
        boolean canDelete = sensors.isEmpty() && gateways.isEmpty();
        return ResponseEntity.ok(Map.of("canDelete", canDelete, "sensors", sensors, "gateways", gateways));
    }

    // ==================== UPDATE ====================

    @PutMapping("/api/configuration/brands/{id}")
    @ResponseBody
    public ResponseEntity<?> updateBrand(@PathVariable Integer id, @RequestBody Map<String, String> body) {
        try {
            Brand updated = brandService.updateName(id, body.get("name"));
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/api/configuration/device-types/{id}")
    @ResponseBody
    public ResponseEntity<?> updateDeviceType(@PathVariable Integer id, @RequestBody Map<String, String> body) {
        try {
            DeviceType updated = deviceTypeService.updateLabel(id, body.get("label"));
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/api/configuration/protocols/{id}")
    @ResponseBody
    public ResponseEntity<?> updateProtocol(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        try {
            String name = (String) body.get("name");
            Boolean availableForGateway = body.get("availableForGateway") instanceof Boolean
                    ? (Boolean) body.get("availableForGateway")
                    : Boolean.parseBoolean(String.valueOf(body.get("availableForGateway")));
            Protocol updated = protocolService.update(id, name, availableForGateway);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

}
