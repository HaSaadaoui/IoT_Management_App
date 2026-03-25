package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.NotificationPreference;
import com.amaris.sensorprocessor.entity.Sensor;
import com.amaris.sensorprocessor.entity.User;
import com.amaris.sensorprocessor.model.dashboard.Alert;
import com.amaris.sensorprocessor.repository.NotificationPreferenceDao;
import com.amaris.sensorprocessor.repository.SensorDao;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
public class NotificationService {

    private final NotificationPreferenceDao notificationPreferenceDao;
    private final UserService userService;
    private final EmailService emailService;
    private final SensorDao sensorDao;

    @Autowired
    public NotificationService(NotificationPreferenceDao notificationPreferenceDao, 
                              UserService userService,
                              EmailService emailService,
                              SensorDao sensorDao) {
        this.notificationPreferenceDao = notificationPreferenceDao;
        this.userService = userService;
        this.emailService = emailService;
        this.sensorDao = sensorDao;
    }

    @PostConstruct
    public void init() {
        notificationPreferenceDao.createTableIfNotExists();
    }

    public void sendAlertNotification(Alert alert, String username, String parameterType) {
        Optional<NotificationPreference> prefOpt = notificationPreferenceDao
                .findByUsernameAndParameter(username, parameterType);
        
        if (prefOpt.isEmpty()) {
            log.debug("No notification preference found for user {} and parameter {}", username, parameterType);
            return;
        }

        NotificationPreference pref = prefOpt.get();
        User user = userService.searchUserByUsername(username);
        
        if (user == null) {
            log.warn("User not found: {}", username);
            return;
        }

        if (pref.isEmailEnabled()) {
            sendEmailAlert(alert, user, pref);
        }

        if (pref.isSmsEnabled()) {
            sendSmsAlert(alert, user, pref);
        }
    }

    private void sendEmailAlert(Alert alert, User user, NotificationPreference pref) {
        String email = pref.getCustomEmail() != null ? pref.getCustomEmail() : user.getEmail();
        
        if (email == null || email.trim().isEmpty()) {
            log.warn("No email configured for user {}", user.getUsername());
            return;
        }

        try {
            log.info("Sending email alert to {}: {}", email, alert.getTitle());
            
            // Extract sensor ID from alert message or title if available
            String sensorId = extractSensorId(alert);
            
            // Call the actual email service
            emailService.sendAlertEmail(email, alert, sensorId);
            
            log.info("Email alert sent successfully to {}", email);
            
        } catch (Exception e) {
            log.error("Failed to send email alert to {}: {}", email, e.getMessage());
        }
    }
    
    private String extractSensorId(Alert alert) {
        // Try to extract sensor ID from alert message
        // Format: "Sensor sensor-id detected ..."
        if (alert.getMessage() != null && alert.getMessage().contains("Sensor ")) {
            String[] parts = alert.getMessage().split("Sensor ");
            if (parts.length > 1) {
                String[] idParts = parts[1].split("[\\s]");
                if (idParts.length > 0) {
                    return idParts[0].trim();
                }
            }
        }
        return "Unknown";
    }

    private void sendSmsAlert(Alert alert, User user, NotificationPreference pref) {
        String phone = pref.getCustomPhone() != null ? pref.getCustomPhone() : user.getPhone();
        
        if (phone == null || phone.trim().isEmpty()) {
            log.warn("No phone configured for user {}", user.getUsername());
            return;
        }

        try {
            String message = String.format("[%s] %s: %s", 
                alert.getLevel().toUpperCase(), 
                alert.getTitle(), 
                alert.getMessage());
            
            log.info("SMS alert would be sent to {}: {}", phone, message);
            
        } catch (Exception e) {
            log.error("Failed to send SMS alert to {}: {}", phone, e.getMessage());
        }
    }


    public void saveNotificationPreference(NotificationPreference preference) {
        notificationPreferenceDao.save(preference);
        log.info("Saved notification preference for user {} and parameter {}", 
                preference.getUsername(), preference.getParameterType());
    }

    public List<NotificationPreference> getUserPreferences(String username) {
        return notificationPreferenceDao.findByUsername(username);
    }

    public Optional<NotificationPreference> getUserPreferenceForParameter(String username, String parameterType) {
        return notificationPreferenceDao.findByUsernameAndParameter(username, parameterType);
    }

    public Optional<NotificationPreference> getPreferenceById(String id) {
        return notificationPreferenceDao.findById(id);
    }

    public void deletePreference(String id) {
        notificationPreferenceDao.delete(id);
    }

    /**
     * Send grouped alert notifications (multiple alerts of same type in one email)
     */
    public void sendGroupedAlertNotification(List<Alert> alerts, String username, String parameterType) {
        if (alerts.isEmpty()) {
            log.warn("No alerts provided for grouped notification");
            return;
        }

        Optional<NotificationPreference> prefOpt = notificationPreferenceDao
                .findByUsernameAndParameter(username, parameterType);
        
        if (prefOpt.isEmpty()) {
            log.debug("No notification preference found for user {} and parameter {}", username, parameterType);
            return;
        }

        NotificationPreference pref = prefOpt.get();
        User user = userService.searchUserByUsername(username);
        
        if (user == null) {
            log.warn("User not found: {}", username);
            return;
        }

        if (pref.isEmailEnabled()) {
            sendGroupedEmailAlert(alerts, user, pref, parameterType);
        }

        if (pref.isSmsEnabled()) {
            sendGroupedSmsAlert(alerts, user, pref, parameterType);
        }
    }

    private void sendGroupedEmailAlert(List<Alert> alerts, User user, NotificationPreference pref, String parameterType) {
        String email = pref.getCustomEmail() != null ? pref.getCustomEmail() : user.getEmail();
        
        if (email == null || email.trim().isEmpty()) {
            log.warn("No email configured for user {}", user.getUsername());
            return;
        }

        try {
            Alert firstAlert = alerts.get(0);
            log.info("Sending grouped email alert ({} alerts) to {}: {} - {}", 
                    alerts.size(), email, firstAlert.getLevel(), parameterType);
            
            // Call the email service with grouped alerts
            emailService.sendGroupedAlertEmail(email, alerts, parameterType);
            
            log.info("Grouped email alert sent successfully to {}", email);
            
        } catch (Exception e) {
            log.error("Failed to send grouped email alert to {}: {}", email, e.getMessage());
        }
    }

    private void sendGroupedSmsAlert(List<Alert> alerts, User user, NotificationPreference pref, String parameterType) {
        String phone = pref.getCustomPhone() != null ? pref.getCustomPhone() : user.getPhone();
        
        if (phone == null || phone.trim().isEmpty()) {
            log.warn("No phone configured for user {}", user.getUsername());
            return;
        }

        try {
            Alert firstAlert = alerts.get(0);
            String message = String.format("[%s] %d %s alerts detected", 
                firstAlert.getLevel().toUpperCase(), alerts.size(), parameterType);
            
            log.info("SMS alert would be sent to {}: {}", phone, message);
            
        } catch (Exception e) {
            log.error("Failed to send SMS alert to {}: {}", phone, e.getMessage());
        }
    }
}
