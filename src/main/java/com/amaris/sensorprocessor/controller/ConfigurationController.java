package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.config.AlertThresholdConfig;
import com.amaris.sensorprocessor.service.AlertConfigurationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseBody;

@Controller
public class ConfigurationController {

    private final AlertThresholdConfig alertThresholdConfig;
    private final AlertConfigurationService alertConfigurationService;

    @Autowired
    public ConfigurationController(AlertThresholdConfig alertThresholdConfig, AlertConfigurationService alertConfigurationService) {
        this.alertThresholdConfig = alertThresholdConfig;
        this.alertConfigurationService = alertConfigurationService;
    }

    @GetMapping("/configuration")
    public String configuration(Model model) {
        model.addAttribute("alertConfig", alertThresholdConfig);
        return "configuration";
    }

    @PostMapping("/api/configuration/alerts")
    @ResponseBody
    public ResponseEntity<?> updateAlertConfig(@RequestBody AlertThresholdConfig newConfig) {
        alertConfigurationService.saveConfig(newConfig);
        return ResponseEntity.ok().body("{\"message\": \"Configuration updated successfully\"}");
    }
}
