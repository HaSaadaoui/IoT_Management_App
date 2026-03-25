package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.model.dashboard.Alert;
import com.amaris.sensorprocessor.service.EmailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@RestController
@RequestMapping("/api/test")
public class TestNotificationController {

    private final EmailService emailService;

    @Autowired
    public TestNotificationController(EmailService emailService) {
        this.emailService = emailService;
    }

    @PostMapping("/send-alert-email")
    @ResponseBody
    public ResponseEntity<?> sendTestAlertEmail(@RequestBody Map<String, String> request) {
        String toEmail = request.get("email");
        String alertLevel = request.getOrDefault("level", "warning");
        String sensorId = request.getOrDefault("sensorId", "dev_eui_001");
        
        if (toEmail == null || toEmail.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email address is required"));
        }

        try {
            // Create a test alert
            Alert testAlert = createTestAlert(alertLevel, sensorId);
            
            // Send the email
            emailService.sendAlertEmail(toEmail, testAlert, sensorId);
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Test alert email sent successfully to " + toEmail,
                "alert", Map.of(
                    "level", testAlert.getLevel(),
                    "title", testAlert.getTitle(),
                    "message", testAlert.getMessage(),
                    "sensorId", sensorId
                )
            ));
            
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", e.getMessage()
            ));
        }
    }

    private Alert createTestAlert(String level, String sensorId) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
        String timestamp = LocalDateTime.now().format(formatter);
        
        return switch (level.toLowerCase()) {
            case "critical" -> new Alert(
                "critical",
                "🚨",
                "Critical CO2 Level Detected",
                String.format("Sensor %s detected 1250 ppm (threshold: 1000 ppm). Immediate ventilation required!", sensorId),
                timestamp
            );
            case "warning" -> new Alert(
                "warning",
                "⚠️",
                "High CO2 Level Warning",
                String.format("Sensor %s detected 850 ppm (threshold: 800 ppm). Consider improving ventilation.", sensorId),
                timestamp
            );
            default -> new Alert(
                "info",
                "ℹ️",
                "Sensor Status Information",
                String.format("Sensor %s is operating normally. All parameters within acceptable ranges.", sensorId),
                timestamp
            );
        };
    }
}
