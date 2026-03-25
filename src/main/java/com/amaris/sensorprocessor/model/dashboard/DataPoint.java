package com.amaris.sensorprocessor.model.dashboard;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class DataPoint {
    private String date;
    private double occupancyRate;
    private int sensorCount;
    private double avgValue;
}
