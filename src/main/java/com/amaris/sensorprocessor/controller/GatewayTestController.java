package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.service.GatewayRealtimeAlertService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/gateway-test")
public class GatewayTestController {

    private final GatewayRealtimeAlertService alertService;

    @Autowired
    public GatewayTestController(GatewayRealtimeAlertService alertService) {
        this.alertService = alertService;
    }

    /**
     * Test endpoint to simulate gateway monitoring data with alerts
     */
    @GetMapping("/simulate-alerts/{gatewayId}")
    public ResponseEntity<Map<String, Object>> simulateGatewayAlerts(@PathVariable String gatewayId) {
        
        // Create simulated monitoring data that will trigger alerts
        Map<String, Object> simulatedSystemData = new HashMap<>();
        simulatedSystemData.put("hostname", "test-gateway-" + gatewayId);
        simulatedSystemData.put("gateway_status", "active");
        simulatedSystemData.put("cpu_percent (%)", 92.5); // Critical CPU
        simulatedSystemData.put("cpu_temp (C)", 75.8); // High temperature
        simulatedSystemData.put("ram_total_gb (GB)", 4.0);
        simulatedSystemData.put("ram_used_gb (GB)", 3.8); // 95% RAM usage - Critical
        simulatedSystemData.put("disk_usage_percent", "88%"); // High disk usage
        simulatedSystemData.put("ip_local", "192.168.1.100");
        simulatedSystemData.put("ip_public", "203.0.113.1");
        simulatedSystemData.put("uptime_days", "15 days 8 hours");
        
        // Process the data to generate alerts
        List<GatewayRealtimeAlertService.GatewayAlert> alerts = 
            alertService.processMonitoringData(gatewayId, "Test Gateway " + gatewayId, simulatedSystemData);
        
        // Return both the simulated data and generated alerts
        Map<String, Object> response = new HashMap<>();
        response.put("gatewayId", gatewayId);
        response.put("systemData", simulatedSystemData);
        response.put("alerts", alerts);
        response.put("alertCount", alerts.size());
        
        return ResponseEntity.ok(response);
    }

    /**
     * Test endpoint with normal (no alerts) data
     */
    @GetMapping("/simulate-normal/{gatewayId}")
    public ResponseEntity<Map<String, Object>> simulateNormalGateway(@PathVariable String gatewayId) {
        
        // Create normal monitoring data (no alerts should be triggered)
        Map<String, Object> normalSystemData = new HashMap<>();
        normalSystemData.put("hostname", "normal-gateway-" + gatewayId);
        normalSystemData.put("gateway_status", "active");
        normalSystemData.put("cpu_percent (%)", 45.2); // Normal CPU
        normalSystemData.put("cpu_temp (C)", 55.3); // Normal temperature
        normalSystemData.put("ram_total_gb (GB)", 4.0);
        normalSystemData.put("ram_used_gb (GB)", 2.1); // 52% RAM usage - Normal
        normalSystemData.put("disk_usage_percent", "65%"); // Normal disk usage
        normalSystemData.put("ip_local", "192.168.1.101");
        normalSystemData.put("ip_public", "203.0.113.2");
        normalSystemData.put("uptime_days", "30 days 12 hours");
        
        // Process the data (should generate no alerts)
        List<GatewayRealtimeAlertService.GatewayAlert> alerts = 
            alertService.processMonitoringData(gatewayId, "Normal Gateway " + gatewayId, normalSystemData);
        
        Map<String, Object> response = new HashMap<>();
        response.put("gatewayId", gatewayId);
        response.put("systemData", normalSystemData);
        response.put("alerts", alerts);
        response.put("alertCount", alerts.size());
        
        return ResponseEntity.ok(response);
    }

    /**
     * Test endpoint with custom thresholds
     */
    @PostMapping("/test-custom")
    public ResponseEntity<Map<String, Object>> testCustomData(@RequestBody Map<String, Object> payload) {
        
        String gatewayId = (String) payload.getOrDefault("gatewayId", "custom-test");
        String gatewayName = (String) payload.getOrDefault("gatewayName", "Custom Test Gateway");
        
        @SuppressWarnings("unchecked")
        Map<String, Object> systemData = (Map<String, Object>) payload.get("systemData");
        
        if (systemData == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "systemData is required"));
        }
        
        // Process the custom data
        List<GatewayRealtimeAlertService.GatewayAlert> alerts = 
            alertService.processMonitoringData(gatewayId, gatewayName, systemData);
        
        Map<String, Object> response = new HashMap<>();
        response.put("gatewayId", gatewayId);
        response.put("gatewayName", gatewayName);
        response.put("systemData", systemData);
        response.put("alerts", alerts);
        response.put("alertCount", alerts.size());
        
        return ResponseEntity.ok(response);
    }
}
