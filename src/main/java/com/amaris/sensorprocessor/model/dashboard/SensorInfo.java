package com.amaris.sensorprocessor.model.dashboard;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class SensorInfo {
    private String idSensor;
    private String deviceType;
    private String location;
    private String buildingName;
    private Integer floor;
    private boolean isActive;
}
