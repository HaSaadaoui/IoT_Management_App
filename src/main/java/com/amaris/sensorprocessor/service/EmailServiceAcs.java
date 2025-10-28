package com.amaris.sensorprocessor.service;

import com.azure.communication.email.EmailClient;
import com.azure.communication.email.EmailClientBuilder;
import com.azure.communication.email.models.EmailAddress;
import com.azure.communication.email.models.EmailMessage;
import com.azure.communication.email.models.EmailSendResult;
import com.azure.communication.email.models.EmailSendStatus;
import com.azure.core.util.polling.PollResponse;
import com.azure.core.util.polling.SyncPoller;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service("emailServiceAcs")
public class EmailServiceAcs implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailServiceAcs.class);
    private EmailClient emailClient; // Not final to allow null assignment

    @Value("${app.mail.acs.from}")
    private String fromAddress;

    public EmailServiceAcs(@Value("${app.mail.acs.connectionString:}") String connectionString) {
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
}
