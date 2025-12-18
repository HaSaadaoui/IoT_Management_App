package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.NotificationPreference;
import com.amaris.sensorprocessor.entity.User;
import com.amaris.sensorprocessor.model.dashboard.Alert;
import com.amaris.sensorprocessor.repository.NotificationPreferenceDao;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class AlertNotificationScheduler {

    private final AlertService alertService;
    private final NotificationService notificationService;
    private final NotificationPreferenceDao notificationPreferenceDao;
    private final UserService userService;
    
    // Track sent alerts to prevent spam (alertKey -> lastSentTime)
    private final Map<String, LocalDateTime> sentAlerts = new ConcurrentHashMap<>();
    
    // Minimum time between same alert notifications (in minutes)
    private static final int ALERT_COOLDOWN_MINUTES = 30;

    @Autowired
    public AlertNotificationScheduler(AlertService alertService, 
                                    NotificationService notificationService,
                                    NotificationPreferenceDao notificationPreferenceDao,
                                    UserService userService) {
        this.alertService = alertService;
        this.notificationService = notificationService;
        this.notificationPreferenceDao = notificationPreferenceDao;
        this.userService = userService;
    }

    /**
     * Check for alerts every 5 minutes and send notifications
     */
    @Scheduled(fixedRate = 300000) // 5 minutes = 300,000 milliseconds
    public void checkAndSendAlertNotifications() {
        log.info("Starting scheduled alert notification check...");
        
        try {
            // Get current alerts from dashboard (same logic as dashboard)
            List<Alert> currentAlerts = alertService.getCurrentAlerts();
            
            if (currentAlerts.isEmpty()) {
                log.debug("No active alerts found");
                return;
            }
            
            log.info("Found {} active alerts, checking notification preferences", currentAlerts.size());
            
            // Get all users with notification preferences
            List<User> allUsers = userService.getAllUsers();
            
            for (User user : allUsers) {
                processUserAlertNotifications(user, currentAlerts);
            }
            
            // Cleanup old sent alerts (older than 2 hours)
            cleanupOldSentAlerts();
            
        } catch (Exception e) {
            log.error("Error during scheduled alert notification check: {}", e.getMessage(), e);
        }
    }

    private void processUserAlertNotifications(User user, List<Alert> alerts) {
        String username = user.getUsername();
        
        // Get user's notification preferences
        List<NotificationPreference> userPreferences = notificationPreferenceDao.findByUsername(username);
        
        if (userPreferences.isEmpty()) {
            log.debug("No notification preferences found for user: {}", username);
            return;
        }
        
        log.info("Processing {} notification preferences for user: {}", userPreferences.size(), username);
        
        // Group alerts by parameter type and level for consolidated emails
        Map<String, List<Alert>> groupedAlerts = new HashMap<>();
        
        for (Alert alert : alerts) {
            String parameterType = getParameterTypeFromAlert(alert);
            log.info("Processing alert: {} - Parameter type: {}", alert.getTitle(), parameterType);
            
            if (parameterType != null) {
                // Find matching notification preference
                NotificationPreference matchingPref = userPreferences.stream()
                    .filter(pref -> parameterType.equalsIgnoreCase(pref.getParameterType()))
                    .findFirst()
                    .orElse(null);
                    
                if (matchingPref != null) {
                    log.info("Found notification preference for user {} and parameter {}: email={}, sms={}", 
                            username, parameterType, matchingPref.isEmailEnabled(), matchingPref.isSmsEnabled());
                    
                    if (matchingPref.isEmailEnabled() || matchingPref.isSmsEnabled()) {
                        String groupKey = parameterType + "_" + alert.getLevel();
                        groupedAlerts.computeIfAbsent(groupKey, k -> new ArrayList<>()).add(alert);
                        log.info("Added alert to group: {}", groupKey);
                    } else {
                        log.info("Notifications disabled for user {} and parameter {}", username, parameterType);
                    }
                } else {
                    log.info("No notification preference found for user {} and parameter {}", username, parameterType);
                }
            } else {
                log.warn("Could not determine parameter type for alert: {}", alert.getTitle());
            }
        }
        
        log.info("Grouped alerts for user {}: {}", username, groupedAlerts.keySet());
        
        // Send consolidated notifications for each group
        for (Map.Entry<String, List<Alert>> entry : groupedAlerts.entrySet()) {
            String groupKey = entry.getKey();
            List<Alert> alertGroup = entry.getValue();
            
            if (!alertGroup.isEmpty()) {
                log.info("Processing alert group {} with {} alerts for user {}", groupKey, alertGroup.size(), username);
                processAlertGroupForUser(alertGroup, user, userPreferences, groupKey);
            }
        }
    }

    private void processAlertGroupForUser(List<Alert> alertGroup, User user, List<NotificationPreference> preferences, String groupKey) {
        if (alertGroup.isEmpty()) return;
        
        Alert firstAlert = alertGroup.get(0);
        String parameterType = getParameterTypeFromAlert(firstAlert);
        
        if (parameterType == null) {
            log.debug("Could not determine parameter type for alert group: {}", groupKey);
            return;
        }
        
        // Find matching notification preference
        NotificationPreference matchingPref = preferences.stream()
            .filter(pref -> parameterType.equalsIgnoreCase(pref.getParameterType()))
            .findFirst()
            .orElse(null);
            
        if (matchingPref == null) {
            log.debug("No notification preference found for user {} and parameter {}", user.getUsername(), parameterType);
            return;
        }
        
        // Check if notifications are enabled for this parameter
        if (!matchingPref.isEmailEnabled() && !matchingPref.isSmsEnabled()) {
            log.debug("Notifications disabled for user {} and parameter {}", user.getUsername(), parameterType);
            return;
        }
        
        // Check if we've already sent this alert group recently (prevent spam)
        String alertKey = generateGroupAlertKey(alertGroup, user.getUsername(), parameterType);
        if (isAlertRecentlySent(alertKey)) {
            log.debug("Alert group already sent recently for key: {}", alertKey);
            return;
        }
        
        // Send the consolidated notification
        log.info("Sending {} grouped alert notifications to user {}: {} - {}", 
                alertGroup.size(), user.getUsername(), firstAlert.getLevel(), parameterType);
        
        try {
            // Send consolidated alert notification
            notificationService.sendGroupedAlertNotification(alertGroup, user.getUsername(), parameterType);
            
            // Mark as sent
            sentAlerts.put(alertKey, LocalDateTime.now());
            
            log.info("Grouped alert notification sent successfully to user {}", user.getUsername());
            
        } catch (Exception e) {
            log.error("Failed to send grouped alert notification to user {}: {}", user.getUsername(), e.getMessage(), e);
        }
    }

    /**
     * Determine parameter type from alert content
     */
    private String getParameterTypeFromAlert(Alert alert) {
        if (alert.getTitle() == null && alert.getMessage() == null) {
            return null;
        }
        
        String content = (alert.getTitle() + " " + alert.getMessage()).toLowerCase();
        
        if (content.contains("co2") || content.contains("carbon")) {
            return "CO2";
        }
        if (content.contains("temperature") || content.contains("temp")) {
            return "TEMPERATURE";
        }
        if (content.contains("humidity")) {
            return "HUMIDITY";
        }
        if (content.contains("noise") || content.contains("sound")) {
            return "NOISE";
        }
        if (content.contains("sensor offline") || content.contains("not responding")) {
            return "SENSOR_OFFLINE";
        }
        
        return null;
    }

    /**
     * Generate unique key for alert group tracking
     */
    private String generateGroupAlertKey(List<Alert> alertGroup, String username, String parameterType) {
        if (alertGroup.isEmpty()) return username + "_" + parameterType + "_empty";
        
        Alert firstAlert = alertGroup.get(0);
        // Use parameter type and level for grouping, not individual sensor IDs
        return String.format("%s_%s_%s_%d", username, parameterType, firstAlert.getLevel(), alertGroup.size());
    }
    
    /**
     * Generate unique key for alert tracking (legacy method)
     */
    private String generateAlertKey(Alert alert, String username, String parameterType) {
        // Extract sensor ID from alert message if possible
        String sensorId = extractSensorIdFromAlert(alert);
        return String.format("%s_%s_%s_%s", username, parameterType, alert.getLevel(), sensorId);
    }

    private String extractSensorIdFromAlert(Alert alert) {
        if (alert.getMessage() != null && alert.getMessage().contains("Sensor ")) {
            String[] parts = alert.getMessage().split("Sensor ");
            if (parts.length > 1) {
                String[] idParts = parts[1].split("[\\s:]");
                if (idParts.length > 0) {
                    return idParts[0].trim();
                }
            }
        }
        return "unknown";
    }

    /**
     * Check if alert was sent recently (within cooldown period)
     */
    private boolean isAlertRecentlySent(String alertKey) {
        LocalDateTime lastSent = sentAlerts.get(alertKey);
        if (lastSent == null) {
            return false;
        }
        
        LocalDateTime cooldownTime = lastSent.plusMinutes(ALERT_COOLDOWN_MINUTES);
        return LocalDateTime.now().isBefore(cooldownTime);
    }

    /**
     * Clean up old sent alert records (older than 2 hours)
     */
    private void cleanupOldSentAlerts() {
        LocalDateTime cutoffTime = LocalDateTime.now().minusHours(2);
        
        sentAlerts.entrySet().removeIf(entry -> entry.getValue().isBefore(cutoffTime));
        
        log.debug("Cleaned up old sent alerts, remaining: {}", sentAlerts.size());
    }

    /**
     * Get statistics about sent alerts (for monitoring)
     */
    public Map<String, Object> getAlertStatistics() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalSentAlerts", sentAlerts.size());
        stats.put("cooldownMinutes", ALERT_COOLDOWN_MINUTES);
        stats.put("lastCleanup", LocalDateTime.now());
        return stats;
    }
}
