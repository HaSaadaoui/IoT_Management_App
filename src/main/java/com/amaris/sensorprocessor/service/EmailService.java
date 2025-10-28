package com.amaris.sensorprocessor.service;

public interface EmailService {
    void sendVerificationEmail(String toEmail, String verificationLink);
}


