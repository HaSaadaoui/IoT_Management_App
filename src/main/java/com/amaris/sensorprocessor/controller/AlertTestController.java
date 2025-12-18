package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.model.dashboard.Alert;
import com.amaris.sensorprocessor.service.AlertServiceTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class AlertTestController {

    private final AlertServiceTest alertServiceTest;

    @Autowired
    public AlertTestController(AlertServiceTest alertServiceTest) {
        this.alertServiceTest = alertServiceTest;
    }

    @GetMapping("/api/test-alerts")
    @ResponseBody
    public List<Alert> getTestAlerts() {
        return alertServiceTest.getTestAlerts();
    }

    @GetMapping("/api/simulate-alerts")
    @ResponseBody
    public String simulateAlerts() {
        return alertServiceTest.simulateTestData();
    }
}