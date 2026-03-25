package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.model.dashboard.Alert;
import java.util.List;

public interface EmailService {
    void sendVerificationEmail(String toEmail, String verificationLink);
    void sendAlertEmail(String toEmail, Alert alert, String sensorId);
    void sendGroupedAlertEmail(String toEmail, List<Alert> alerts, String parameterType);
}


