package com.amaris.sensorprocessor.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AlertConfigEntity {
    private Long id;
    private int dataMaxAgeMinutes;
    private double co2Critical;
    private double co2Warning;
    private double tempCriticalHigh;
    private double tempCriticalLow;
    private double tempWarningHigh;
    private double tempWarningLow;
    private double humidityWarningHigh;
    private double humidityWarningLow;
    private double noiseWarning;
}
