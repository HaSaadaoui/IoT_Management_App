package com.amaris.sensorprocessor.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SensorThreshold {
    private Long id;
    private String sensorId;
    private String parameterType;
    private Double warningThreshold;
    private Double criticalThreshold;
    private Double warningLow;
    private Double criticalLow;
    private boolean enabled;
}
