package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.Sensor;
import com.amaris.sensorprocessor.model.dashboard.Alert;
import com.amaris.sensorprocessor.repository.SensorDao;
import com.azure.communication.email.EmailClient;
import com.azure.communication.email.EmailClientBuilder;
import com.azure.communication.email.models.EmailAddress;
import com.azure.communication.email.models.EmailMessage;
import com.azure.communication.email.models.EmailSendResult;
import com.azure.communication.email.models.EmailSendStatus;
import com.azure.core.util.polling.PollResponse;
import com.azure.core.util.polling.SyncPoller;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

@Service("emailServiceAcs")
public class EmailServiceAcs implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailServiceAcs.class);
    private EmailClient emailClient;
    private final String fromAddress;
    private final SensorDao sensorDao;

    @Autowired
    public EmailServiceAcs(@Value("${app.mail.acs.connectionString:}") String connectionString,
                          @Value("${app.mail.acs.from:}") String fromAddress,
                          SensorDao sensorDao) {
        this.fromAddress = fromAddress;
        this.sensorDao = sensorDao;

        // Allow empty connection string for tests, but log warning
        if (connectionString == null || connectionString.isEmpty() || connectionString.contains("PASTE_PRIMARY_KEY_HERE")) {
            this.emailClient = null;
            log.warn("⚠️ ACS connection string not configured. Email service will not work.");
            log.warn("Please update application.properties with your Azure Communication Services Primary Key");
            log.warn("For production, set: app.mail.acs.connectionString=endpoint=...;accesskey=...");
            return; // Don't throw exception, allow app to start
        }
        
        try {
            this.emailClient = new EmailClientBuilder()
                    .connectionString(connectionString)
                    .buildClient();
            log.info("✅ Azure Communication Services Email client initialized successfully");
            log.info("Sender address: {}", fromAddress);
        } catch (Exception e) {
            this.emailClient = null;
            log.error("❌ Failed to initialize ACS Email client: {}", e.getMessage());
            log.error("Please verify your connection string in application.properties");
        }
    }

    @Override
    public void sendVerificationEmail(String toEmail, String verificationLink) {
        if (emailClient == null) {
            log.error("❌ ACS Email client not initialized. Cannot send email.");
            throw new RuntimeException("ACS Email client not configured");
        }

        try {
            log.info("Attempting to send verification email via Azure Communication Services to: {}", toEmail);

            // Create email message
            EmailMessage emailMessage = new EmailMessage()
                    .setSenderAddress(fromAddress)
                    .setToRecipients(new EmailAddress(toEmail))
                    .setSubject("Verify your email")
                    .setBodyPlainText("Click the link to verify your account: " + verificationLink);

            // Send email
            SyncPoller<EmailSendResult, EmailSendResult> poller = emailClient.beginSend(emailMessage);

            // Wait for completion with timeout
            PollResponse<EmailSendResult> response = poller.waitForCompletion(Duration.ofMinutes(2));

            if (response.getValue() != null) {
                EmailSendResult result = response.getValue();
                EmailSendStatus status = result.getStatus();

                if (status == EmailSendStatus.SUCCEEDED) {
                    log.info("Verification email sent successfully via ACS to: {}. Message ID: {}", 
                            toEmail, result.getId());
                } else {
                    log.error("Failed to send verification email via ACS to: {}. Status: {}", 
                            toEmail, status);
                    throw new RuntimeException("Email send failed with status: " + status);
                }
            } else {
                log.error("No response received from ACS for email to: {}", toEmail);
                throw new RuntimeException("No response from Azure Communication Services");
            }

        } catch (Exception e) {
            log.error("Failed to send verification email via ACS to: {}. Error: {}", 
                    toEmail, e.getMessage(), e);
            throw new RuntimeException("Failed to send verification email via ACS: " + e.getMessage(), e);
        }
    }

    @Override
    public void sendAlertEmail(String toEmail, Alert alert, String sensorId) {
        if (emailClient == null) {
            log.error("❌ ACS Email client not initialized. Cannot send alert email.");
            throw new RuntimeException("ACS Email client not configured");
        }

        try {
            log.info("Attempting to send alert email via Azure Communication Services to: {}", toEmail);

            String subject = buildAlertSubject(alert);
            String htmlBody = buildAlertEmailHtml(alert, sensorId);
            String plainText = buildAlertEmailPlainText(alert, sensorId);

            // Create email message
            EmailMessage emailMessage = new EmailMessage()
                    .setSenderAddress(fromAddress)
                    .setToRecipients(new EmailAddress(toEmail))
                    .setSubject(subject)
                    .setBodyPlainText(plainText)
                    .setBodyHtml(htmlBody);

            // Send email
            SyncPoller<EmailSendResult, EmailSendResult> poller = emailClient.beginSend(emailMessage);

            // Wait for completion with timeout
            PollResponse<EmailSendResult> response = poller.waitForCompletion(Duration.ofMinutes(2));

            if (response.getValue() != null) {
                EmailSendResult result = response.getValue();
                EmailSendStatus status = result.getStatus();

                if (status == EmailSendStatus.SUCCEEDED) {
                    log.info("Alert email sent successfully via ACS to: {}. Message ID: {}", 
                            toEmail, result.getId());
                } else {
                    log.error("Failed to send alert email via ACS to: {}. Status: {}", 
                            toEmail, status);
                    throw new RuntimeException("Email send failed with status: " + status);
                }
            } else {
                log.error("No response received from ACS for alert email to: {}", toEmail);
                throw new RuntimeException("No response from Azure Communication Services");
            }

        } catch (Exception e) {
            log.error("Failed to send alert email via ACS to: {}. Error: {}", 
                    toEmail, e.getMessage(), e);
            throw new RuntimeException("Failed to send alert email via ACS: " + e.getMessage(), e);
        }
    }

    @Override
    public void sendGroupedAlertEmail(String toEmail, List<Alert> alerts, String parameterType) {
        if (emailClient == null) {
            log.error("❌ ACS Email client not initialized. Cannot send grouped alert email.");
            throw new RuntimeException("ACS Email client not configured");
        }

        if (alerts.isEmpty()) {
            log.warn("No alerts provided for grouped email");
            return;
        }

        try {
            log.info("Attempting to send grouped alert email via Azure Communication Services to: {} ({} alerts)", 
                    toEmail, alerts.size());

            Alert firstAlert = alerts.get(0);
            String subject = buildGroupedAlertSubject(alerts, parameterType);
            String htmlBody = buildGroupedAlertEmailHtml(alerts, parameterType);
            String plainText = buildGroupedAlertEmailPlainText(alerts, parameterType);

            // Create email message
            EmailMessage emailMessage = new EmailMessage()
                    .setSenderAddress(fromAddress)
                    .setToRecipients(new EmailAddress(toEmail))
                    .setSubject(subject)
                    .setBodyPlainText(plainText)
                    .setBodyHtml(htmlBody);

            // Send email
            SyncPoller<EmailSendResult, EmailSendResult> poller = emailClient.beginSend(emailMessage);

            // Wait for completion with timeout
            PollResponse<EmailSendResult> response = poller.waitForCompletion(Duration.ofMinutes(2));

            if (response.getValue() != null) {
                EmailSendResult result = response.getValue();
                EmailSendStatus status = result.getStatus();

                if (status == EmailSendStatus.SUCCEEDED) {
                    log.info("Grouped alert email sent successfully via ACS to: {}. Message ID: {}", 
                            toEmail, result.getId());
                } else {
                    log.error("Failed to send grouped alert email via ACS to: {}. Status: {}", 
                            toEmail, status);
                    throw new RuntimeException("Email send failed with status: " + status);
                }
            } else {
                log.error("No response received from ACS for grouped alert email to: {}", toEmail);
                throw new RuntimeException("No response from Azure Communication Services");
            }

        } catch (Exception e) {
            log.error("Failed to send grouped alert email via ACS to: {}. Error: {}", 
                    toEmail, e.getMessage(), e);
            throw new RuntimeException("Failed to send grouped alert email via ACS: " + e.getMessage(), e);
        }
    }

    private String buildAlertSubject(Alert alert) {
        String emoji = getAlertEmoji(alert.getLevel());
        return String.format("%s [%s Alert] %s", emoji, alert.getLevel().toUpperCase(), alert.getTitle());
    }

    private String getAlertEmoji(String level) {
        return switch (level != null ? level.toLowerCase() : "") {
            case "critical" -> "🚨";
            case "warning" -> "⚠️";
            default -> "ℹ️";
        };
    }

    private String buildAlertEmailPlainText(Alert alert, String sensorId) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
        String formattedTime = alert.getTime() != null ? alert.getTime() : LocalDateTime.now().format(formatter);

        return String.format("""
            ALERT NOTIFICATION
            
            Level: %s
            Title: %s
            Message: %s
            Sensor: %s
            Time: %s
            
            ---
            IoT Management System - Mantu
            This is an automated alert notification.
            """, 
            alert.getLevel().toUpperCase(), 
            alert.getTitle(), 
            alert.getMessage(),
            sensorId != null ? sensorId : "N/A",
            formattedTime);
    }

    private String buildAlertEmailHtml(Alert alert, String sensorId) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
        String formattedTime = alert.getTime() != null ? alert.getTime() : LocalDateTime.now().format(formatter);
        
        String levelColor = getLevelColor(alert.getLevel());
        String emoji = getAlertEmoji(alert.getLevel());
        
        return String.format("""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4;">
                <table width="100%%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
                    <tr>
                        <td align="center">
                            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                                <!-- Header -->
                                <tr>
                                    <td style="background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); padding: 30px 40px; text-align: center;">
                                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">%s Alert Notification</h1>
                                        <p style="color: #ffffff; margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">IoT Management System</p>
                                    </td>
                                </tr>
                                
                                <!-- Alert Badge -->
                                <tr>
                                    <td style="padding: 30px 40px 20px 40px; text-align: center;">
                                        <div style="display: inline-block; background-color: %s; color: #ffffff; padding: 12px 24px; border-radius: 25px; font-weight: 600; font-size: 16px;">
                                            %s %s
                                        </div>
                                    </td>
                                </tr>
                                
                                <!-- Content -->
                                <tr>
                                    <td style="padding: 0 40px 30px 40px;">
                                        <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">%s</h2>
                                        <p style="color: #666666; margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">%s</p>
                                        
                                        <!-- Alert Details Box -->
                                        <table width="100%%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-left: 4px solid %s; border-radius: 4px; margin: 20px 0;">
                                            <tr>
                                                <td style="padding: 20px;">
                                                    <table width="100%%" cellpadding="8" cellspacing="0">
                                                        <tr>
                                                            <td style="color: #666666; font-size: 14px; font-weight: 600; width: 30%%;">
                                                                🔔 Alert Level:
                                                            </td>
                                                            <td style="color: #333333; font-size: 14px;">
                                                                <strong style="color: %s;">%s</strong>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="color: #666666; font-size: 14px; font-weight: 600;">
                                                                📡 Sensor ID:
                                                            </td>
                                                            <td style="color: #333333; font-size: 14px;">
                                                                <code style="background-color: #e9ecef; padding: 4px 8px; border-radius: 3px; font-family: 'Courier New', monospace;">%s</code>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="color: #666666; font-size: 14px; font-weight: 600;">
                                                                🕐 Timestamp:
                                                            </td>
                                                            <td style="color: #333333; font-size: 14px;">
                                                                %s
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <div style="text-align: center; margin-top: 30px;">
                                            <a href="http://localhost:8080/dashboard" style="display: inline-block; background-color: #667eea; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">View Dashboard</a>
                                        </div>
                                    </td>
                                </tr>
                                
                                <!-- Footer -->
                                <tr>
                                    <td style="background-color: #f8f9fa; padding: 25px 40px; text-align: center; border-top: 1px solid #e9ecef;">
                                        <p style="color: #999999; margin: 0; font-size: 13px; line-height: 1.6;">
                                            This is an automated alert notification from your IoT Management System.<br>
                                            <strong style="color: #667eea;">Mantu Group</strong> © 2025
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """,
            emoji,
            levelColor,
            emoji,
            alert.getLevel().toUpperCase(),
            alert.getTitle(),
            alert.getMessage(),
            levelColor,
            levelColor,
            alert.getLevel().toUpperCase(),
            sensorId != null ? sensorId : "N/A",
            formattedTime
        );
    }

    private String getLevelColor(String level) {
        return switch (level != null ? level.toLowerCase() : "") {
            case "critical" -> "#dc3545";
            case "warning" -> "#ffc107";
            default -> "#17a2b8";
        };
    }

    // Grouped alert email methods
    private String buildGroupedAlertSubject(List<Alert> alerts, String parameterType) {
        if (alerts.isEmpty()) return "Alert Notification";
        
        Alert firstAlert = alerts.get(0);
        String emoji = getAlertEmoji(firstAlert.getLevel());
        String level = firstAlert.getLevel().toUpperCase();
        
        if (alerts.size() == 1) {
            return String.format("%s [%s Alert] %s", emoji, level, firstAlert.getTitle());
        } else {
            return String.format("%s [%s Alerts] %d %s %s Alerts Detected", 
                    emoji, level, alerts.size(), parameterType, level);
        }
    }

    private String buildGroupedAlertEmailPlainText(List<Alert> alerts, String parameterType) {
        if (alerts.isEmpty()) return "No alerts";
        
        StringBuilder sb = new StringBuilder();
        Alert firstAlert = alerts.get(0);
        
        sb.append("MULTIPLE ALERT NOTIFICATION\n\n");
        sb.append(String.format("Parameter Type: %s\n", parameterType));
        sb.append(String.format("Alert Level: %s\n", firstAlert.getLevel().toUpperCase()));
        sb.append(String.format("Total Alerts: %d\n\n", alerts.size()));
        
        sb.append("AFFECTED SENSORS:\n");
        sb.append("================\n\n");
        
        for (int i = 0; i < alerts.size(); i++) {
            Alert alert = alerts.get(i);
            String sensorId = extractSensorIdFromMessage(alert.getMessage());
            String location = getSensorLocationInfo(sensorId);
            
            sb.append(String.format("%d. %s\n", i + 1, alert.getTitle()));
            sb.append(String.format("   Message: %s\n", alert.getMessage()));
            sb.append(String.format("   📡 Sensor: %s\n", sensorId));
            sb.append(String.format("   🏢 Location: %s\n", location));
            sb.append(String.format("   🕐 Time: %s\n\n", alert.getTime()));
        }
        
        sb.append("---\n");
        sb.append("IoT Management System - Mantu\n");
        sb.append("This is an automated alert notification.\n");
        
        return sb.toString();
    }

    private String buildGroupedAlertEmailHtml(List<Alert> alerts, String parameterType) {
        if (alerts.isEmpty()) return "<p>No alerts</p>";
        
        Alert firstAlert = alerts.get(0);
        String levelColor = getLevelColor(firstAlert.getLevel());
        String emoji = getAlertEmoji(firstAlert.getLevel());
        
        StringBuilder alertRows = new StringBuilder();
        
        for (int i = 0; i < alerts.size(); i++) {
            Alert alert = alerts.get(i);
            String sensorId = extractSensorIdFromMessage(alert.getMessage());
            String location = getSensorLocationInfo(sensorId);
            
            alertRows.append(String.format("""
                <tr style="border-bottom: 1px solid #e9ecef;">
                    <td style="padding: 15px 20px;">
                        <div style="margin-bottom: 8px;">
                            <strong style="color: #333; font-size: 16px;">%s</strong>
                        </div>
                        <div style="color: #666; font-size: 14px; margin-bottom: 8px;">%s</div>
                        <div style="font-size: 13px; color: #888;">
                            <div style="margin-bottom: 4px;">📡 <strong>Sensor:</strong> <code style="background: #f8f9fa; padding: 2px 6px; border-radius: 3px;">%s</code></div>
                            <div style="margin-bottom: 4px;">🏢 <strong>Location:</strong> %s</div>
                            <div>🕐 <strong>Time:</strong> %s</div>
                        </div>
                    </td>
                </tr>
                """, alert.getTitle(), alert.getMessage(), sensorId, location, alert.getTime()));
        }
        
        return String.format("""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4;">
                <table width="100%%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
                    <tr>
                        <td align="center">
                            <table width="700" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                                <!-- Header -->
                                <tr>
                                    <td style="background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); padding: 30px 40px; text-align: center;">
                                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">%s Multiple Alert Notification</h1>
                                        <p style="color: #ffffff; margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">IoT Management System</p>
                                    </td>
                                </tr>
                                
                                <!-- Summary Badge -->
                                <tr>
                                    <td style="padding: 30px 40px 20px 40px; text-align: center;">
                                        <div style="display: inline-block; background-color: %s; color: #ffffff; padding: 15px 30px; border-radius: 25px; font-weight: 600; font-size: 18px;">
                                            %s %d %s %s Alerts
                                        </div>
                                    </td>
                                </tr>
                                
                                <!-- Alert List -->
                                <tr>
                                    <td style="padding: 0 40px 30px 40px;">
                                        <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">Affected Sensors</h2>
                                        
                                        <table width="100%%" cellpadding="0" cellspacing="0" style="border: 1px solid #e9ecef; border-radius: 6px; overflow: hidden;">
                                            %s
                                        </table>
                                        
                                        <div style="text-align: center; margin-top: 30px;">
                                            <a href="http://localhost:8080/dashboard" style="display: inline-block; background-color: #667eea; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">View Dashboard</a>
                                        </div>
                                    </td>
                                </tr>
                                
                                <!-- Footer -->
                                <tr>
                                    <td style="background-color: #f8f9fa; padding: 25px 40px; text-align: center; border-top: 1px solid #e9ecef;">
                                        <p style="color: #999999; margin: 0; font-size: 13px; line-height: 1.6;">
                                            This is an automated alert notification from your IoT Management System.<br>
                                            <strong style="color: #667eea;">Mantu Group</strong> © 2025
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """,
            emoji,
            levelColor,
            emoji,
            alerts.size(),
            parameterType,
            firstAlert.getLevel().toUpperCase(),
            alertRows.toString()
        );
    }

    private String extractSensorIdFromMessage(String message) {
        if (message != null && message.contains("Sensor ")) {
            String[] parts = message.split("Sensor ");
            if (parts.length > 1) {
                String[] idParts = parts[1].split("[\\s]");
                if (idParts.length > 0) {
                    return idParts[0].trim();
                }
            }
        }
        return "Unknown";
    }

    private String getSensorLocationInfo(String sensorId) {
        try {
            Optional<Sensor> sensorOpt = sensorDao.findByIdOfSensor(sensorId);
            if (sensorOpt.isPresent()) {
                Sensor sensor = sensorOpt.get();
                String building = sensor.getBuildingName() != null ? sensor.getBuildingName() : "Unknown Building";
                String floor = sensor.getFloor() != null ? "Floor " + sensor.getFloor() : "Unknown Floor";
                String location = sensor.getLocation() != null ? sensor.getLocation() : "";
                
                if (!location.isEmpty()) {
                    return String.format("%s, %s - %s", building, floor, location);
                } else {
                    return String.format("%s, %s", building, floor);
                }
            }
        } catch (Exception e) {
            log.debug("Could not fetch sensor location for {}: {}", sensorId, e.getMessage());
        }
        return "Unknown Location";
    }
}
