package com.amaris.sensorprocessor.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ConfigurationController {

    @GetMapping("/configuration")
    public String configuration() {
        return "configuration"; // correspond à src/main/resources/templates/configuration.html
    }
}
