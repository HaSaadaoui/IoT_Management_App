package com.amaris.sensorprocessor.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/gateway-config")
public class GatewayConfigController {

    @Autowired
    private ConfigurableEnvironment environment;

    /**
     * Get current gateway alert thresholds
     */
    @GetMapping("/thresholds")
    public ResponseEntity<Map<String, Object>> getGatewayThresholds() {
        Map<String, Object> thresholds = new HashMap<>();
        
        // CPU thresholds
        Map<String, Double> cpu = new HashMap<>();
        cpu.put("warning", Double.parseDouble(environment.getProperty("gateway.alert.thresholds.cpu.warning", "70.0")));
        cpu.put("critical", Double.parseDouble(environment.getProperty("gateway.alert.thresholds.cpu.critical", "85.0")));
        thresholds.put("cpu", cpu);
        
        // RAM thresholds
        Map<String, Double> ram = new HashMap<>();
        ram.put("warning", Double.parseDouble(environment.getProperty("gateway.alert.thresholds.ram.warning", "70.0")));
        ram.put("critical", Double.parseDouble(environment.getProperty("gateway.alert.thresholds.ram.critical", "85.0")));
        thresholds.put("ram", ram);
        
        // Disk thresholds
        Map<String, Double> disk = new HashMap<>();
        disk.put("warning", Double.parseDouble(environment.getProperty("gateway.alert.thresholds.disk.warning", "80.0")));
        disk.put("critical", Double.parseDouble(environment.getProperty("gateway.alert.thresholds.disk.critical", "90.0")));
        thresholds.put("disk", disk);
        
        // Temperature thresholds
        Map<String, Double> temperature = new HashMap<>();
        temperature.put("warning", Double.parseDouble(environment.getProperty("gateway.alert.thresholds.temperature.warning", "70.0")));
        temperature.put("critical", Double.parseDouble(environment.getProperty("gateway.alert.thresholds.temperature.critical", "80.0")));
        thresholds.put("temperature", temperature);
        
        return ResponseEntity.ok(thresholds);
    }

    /**
     * Update gateway alert thresholds dynamically
     */
    @PostMapping("/thresholds")
    public ResponseEntity<Map<String, Object>> updateGatewayThresholds(@RequestBody Map<String, Object> newThresholds) {
        try {
            Map<String, Object> propertiesToUpdate = new HashMap<>();
            
            // Process CPU thresholds
            if (newThresholds.containsKey("cpu")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> cpu = (Map<String, Object>) newThresholds.get("cpu");
                if (cpu.containsKey("warning")) {
                    propertiesToUpdate.put("gateway.alert.thresholds.cpu.warning", cpu.get("warning").toString());
                }
                if (cpu.containsKey("critical")) {
                    propertiesToUpdate.put("gateway.alert.thresholds.cpu.critical", cpu.get("critical").toString());
                }
            }
            
            // Process RAM thresholds
            if (newThresholds.containsKey("ram")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> ram = (Map<String, Object>) newThresholds.get("ram");
                if (ram.containsKey("warning")) {
                    propertiesToUpdate.put("gateway.alert.thresholds.ram.warning", ram.get("warning").toString());
                }
                if (ram.containsKey("critical")) {
                    propertiesToUpdate.put("gateway.alert.thresholds.ram.critical", ram.get("critical").toString());
                }
            }
            
            // Process Disk thresholds
            if (newThresholds.containsKey("disk")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> disk = (Map<String, Object>) newThresholds.get("disk");
                if (disk.containsKey("warning")) {
                    propertiesToUpdate.put("gateway.alert.thresholds.disk.warning", disk.get("warning").toString());
                }
                if (disk.containsKey("critical")) {
                    propertiesToUpdate.put("gateway.alert.thresholds.disk.critical", disk.get("critical").toString());
                }
            }
            
            // Process Temperature thresholds
            if (newThresholds.containsKey("temperature")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> temperature = (Map<String, Object>) newThresholds.get("temperature");
                if (temperature.containsKey("warning")) {
                    propertiesToUpdate.put("gateway.alert.thresholds.temperature.warning", temperature.get("warning").toString());
                }
                if (temperature.containsKey("critical")) {
                    propertiesToUpdate.put("gateway.alert.thresholds.temperature.critical", temperature.get("critical").toString());
                }
            }
            
            // Update properties dynamically
            if (!propertiesToUpdate.isEmpty()) {
                MapPropertySource propertySource = new MapPropertySource("gatewayThresholds", propertiesToUpdate);
                environment.getPropertySources().addFirst(propertySource);
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Gateway thresholds updated successfully");
            response.put("updatedProperties", propertiesToUpdate.keySet());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Failed to update gateway thresholds: " + e.getMessage());
            
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }

    /**
     * Reset gateway thresholds to defaults
     */
    @PostMapping("/thresholds/reset")
    public ResponseEntity<Map<String, Object>> resetGatewayThresholds() {
        Map<String, Object> defaultThresholds = new HashMap<>();
        
        // Default values
        Map<String, Object> cpu = new HashMap<>();
        cpu.put("warning", 70.0);
        cpu.put("critical", 85.0);
        defaultThresholds.put("cpu", cpu);
        
        Map<String, Object> ram = new HashMap<>();
        ram.put("warning", 70.0);
        ram.put("critical", 85.0);
        defaultThresholds.put("ram", ram);
        
        Map<String, Object> disk = new HashMap<>();
        disk.put("warning", 80.0);
        disk.put("critical", 90.0);
        defaultThresholds.put("disk", disk);
        
        Map<String, Object> temperature = new HashMap<>();
        temperature.put("warning", 70.0);
        temperature.put("critical", 80.0);
        defaultThresholds.put("temperature", temperature);
        
        // Apply defaults
        return updateGatewayThresholds(defaultThresholds);
    }
}
