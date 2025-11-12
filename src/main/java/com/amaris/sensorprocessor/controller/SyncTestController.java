package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.service.SensorSyncService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Controller for testing TTN synchronization functionality
 */
@Slf4j
@RestController
@RequestMapping("/api/test")
@RequiredArgsConstructor
public class SyncTestController {

    private final SensorSyncService sensorSyncService;

    /**
     * Test endpoint to verify TTN synchronization for all gateways
     * GET /api/test/sync-status
     */
    @GetMapping("/sync-status")
    public ResponseEntity<Map<String, Object>> testSyncStatus() {
        Map<String, Object> result = new HashMap<>();
        
        try {
            // Test synchronization for known gateways
            String[] gateways = {"rpi-mantu", "leva-rpi-mantu", "lil-rpi-mantu"};
            
            for (String gatewayId : gateways) {
                SensorSyncService.SyncReport report = sensorSyncService.compareWithTTN(gatewayId);
                result.put(gatewayId, report);
                log.info("[SyncTest] Gateway {}: TTN={}, DB={}, Missing in DB={}, Missing in TTN={}", 
                    gatewayId, report.getTtnDeviceCount(), report.getDbSensorCount(), 
                    report.getMissingInDb().size(), report.getMissingInTtn().size());
            }
            
            result.put("status", "success");
            result.put("message", "TTN synchronization status retrieved successfully");
            
        } catch (Exception e) {
            log.error("[SyncTest] Error testing sync status: {}", e.getMessage(), e);
            result.put("status", "error");
            result.put("message", e.getMessage());
        }
        
        return ResponseEntity.ok(result);
    }

    /**
     * Test endpoint to perform synchronization for a specific gateway
     * POST /api/test/sync/{gatewayId}
     */
    @PostMapping("/sync/{gatewayId}")
    public ResponseEntity<Map<String, Object>> testSync(@PathVariable String gatewayId) {
        Map<String, Object> result = new HashMap<>();
        
        try {
            // Get sync report before
            SensorSyncService.SyncReport beforeReport = sensorSyncService.compareWithTTN(gatewayId);
            
            // Perform synchronization
            int syncCount = sensorSyncService.syncSensorsFromTTN(gatewayId);
            
            // Get sync report after
            SensorSyncService.SyncReport afterReport = sensorSyncService.compareWithTTN(gatewayId);
            
            result.put("status", "success");
            result.put("gatewayId", gatewayId);
            result.put("syncCount", syncCount);
            result.put("before", beforeReport);
            result.put("after", afterReport);
            result.put("message", "Synchronized " + syncCount + " sensors from TTN");
            
            log.info("[SyncTest] Gateway {} sync completed: {} sensors synchronized", gatewayId, syncCount);
            
        } catch (Exception e) {
            log.error("[SyncTest] Error syncing gateway {}: {}", gatewayId, e.getMessage(), e);
            result.put("status", "error");
            result.put("gatewayId", gatewayId);
            result.put("message", e.getMessage());
        }
        
        return ResponseEntity.ok(result);
    }
}
