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
        private double critical = 1000.0;  // ppm
        private double warning = 800.0;   // ppm
    }

    @Data
    public static class TemperatureThresholds {
        private double criticalHigh = 30.0;  // °C
        private double criticalLow = 16.0;   // °C
        private double warningHigh = 26.0;   // °C
        private double warningLow = 19.0;    // °C
    }

    @Data
    public static class HumidityThresholds {
        private double warningHigh = 70.0;  // %
        private double warningLow = 30.0;   // %
    }

    @Data
    public static class NoiseThresholds {
        private double warning = 70.0;  // dB
    }
}
