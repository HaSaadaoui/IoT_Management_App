package com.amaris.sensorprocessor.service;

import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.stereotype.Service;

@Service
public class ApplicationRestartService {

    private final ConfigurableApplicationContext applicationContext;

    public ApplicationRestartService(ConfigurableApplicationContext applicationContext) {
        this.applicationContext = applicationContext;
    }

    public void restart() {
        Thread restartThread = new Thread(() -> {
            sleepBeforeRestart();
            if (restartWithDevTools()) {
                return;
            }
            int exitCode = SpringApplication.exit(applicationContext, () -> 0);
            System.exit(exitCode);
        }, "application-restart");
        restartThread.setDaemon(false);
        restartThread.start();
    }

    private boolean restartWithDevTools() {
        try {
            Class<?> restarterClass = Class.forName("org.springframework.boot.devtools.restart.Restarter");
            Object restarter = restarterClass.getMethod("getInstance").invoke(null);
            if (restarter == null) {
                return false;
            }
            restarterClass.getMethod("restart").invoke(restarter);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private void sleepBeforeRestart() {
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
