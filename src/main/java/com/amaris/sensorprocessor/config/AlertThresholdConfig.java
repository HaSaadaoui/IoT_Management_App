package com.amaris.sensorprocessor.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "alert.thresholds")
public class AlertThresholdConfig {

    private int dataMaxAgeMinutes = 60;  // Ignore alerts older than 1 hour by default

    private Co2Thresholds co2 = new Co2Thresholds();
    private TemperatureThresholds temperature = new TemperatureThresholds();
    private HumidityThresholds humidity = new HumidityThresholds();
    private NoiseThresholds noise = new NoiseThresholds();

    @Data
    public static class Co2Thresholds {
        private double critical = 600.0;  // ppm
        private double warning = 400.0;   // ppm
    }

    @Data
    public static class TemperatureThresholds {
        private double criticalHigh = 25.0;  // °C
        private double criticalLow = 20.0;   // °C
        private double warningHigh = 23.0;   // °C
        private double warningLow = 18.0;    // °C
    }

    @Data
    public static class HumidityThresholds {
        private double warningHigh = 60.0;  // %
        private double warningLow = 40.0;   // %
    }

    @Data
    public static class NoiseThresholds {
        private double warning = 50.0;  // dB
    }
}
