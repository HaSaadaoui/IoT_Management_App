package com.amaris.sensorprocessor.model.dashboard;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class LiveSensorData {
    private String title;
    private double free;
    private double used;
    private double invalid;
}
