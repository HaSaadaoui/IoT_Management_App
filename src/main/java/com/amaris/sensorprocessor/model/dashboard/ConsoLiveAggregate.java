package com.amaris.sensorprocessor.model.dashboard;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ConsoLiveAggregate {
    private String building;

    private double powerTotalW;
    private double powerTotalkW;

    private double todayEnergyWh;
    private double todayEnergykWh;

    private int deviceCount;
    private long updatedAtEpochMs;
}
