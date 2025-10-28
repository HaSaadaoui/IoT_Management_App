package com.amaris.sensorprocessor.config;

import com.amaris.sensorprocessor.service.SignupService;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@EnableScheduling
@Component
public class SchedulerConfig {

    private final SignupService signupService;

    public SchedulerConfig(SignupService signupService) {
        this.signupService = signupService;
    }

    @Scheduled(cron = "0 0 * * * *") // hourly
    public void cleanupPendingUsers() {
        signupService.cleanupExpired();
    }
}


