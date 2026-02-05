package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.config.AlertThresholdConfig;
import com.amaris.sensorprocessor.entity.*;
import com.amaris.sensorprocessor.repository.AlertConfigurationDao;
import com.amaris.sensorprocessor.repository.SensorDao;
import com.amaris.sensorprocessor.service.AlertConfigurationService;
import com.amaris.sensorprocessor.service.NotificationService;
import com.amaris.sensorprocessor.service.SensorThresholdService;
import com.amaris.sensorprocessor.service.UserService;
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


    @Autowired
    public ConfigurationController(AlertThresholdConfig alertThresholdConfig,
                                   AlertConfigurationService alertConfigurationService,
                                   NotificationService notificationService,
                                   SensorThresholdService sensorThresholdService,
                                   UserService userService,
                                   SensorDao sensorDao, AlertConfigurationDao alertConfigurationDao) {
        this.alertThresholdConfig = alertThresholdConfig;
        this.alertConfigurationService = alertConfigurationService;
        this.notificationService = notificationService;
        this.sensorThresholdService = sensorThresholdService;
        this.userService = userService;
        this.sensorDao = sensorDao;
        this.alertConfigurationDao = alertConfigurationDao;
    }

    @GetMapping("/configuration")
    public String configuration(Model model, Principal principal) {
        model.addAttribute("alertConfig", alertThresholdConfig);
        
        // Add sensors to model like manageSensors page does
        List<Sensor> sensors = sensorDao.findAllSensors();
        model.addAttribute("sensors", sensors);
        
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
        return config != null ? config : new AlertConfigEntity(); // fallback si pas en DB
    }

}
