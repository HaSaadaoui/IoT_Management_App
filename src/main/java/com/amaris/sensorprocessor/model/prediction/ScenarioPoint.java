package com.amaris.sensorprocessor.model.prediction;

import com.fasterxml.jackson.annotation.JsonProperty;

public class ScenarioPoint {

    private String scenario;

    @JsonProperty("predicted_consumption")
    private double predictedConsumption;

    private double delta;

    @JsonProperty("delta_pct")
    private double deltaPct;

    public String getScenario() { return scenario; }
    public void setScenario(String scenario) { this.scenario = scenario; }

    public double getPredictedConsumption() { return predictedConsumption; }
    public void setPredictedConsumption(double predictedConsumption) { this.predictedConsumption = predictedConsumption; }

    public double getDelta() { return delta; }
    public void setDelta(double delta) { this.delta = delta; }

    public double getDeltaPct() { return deltaPct; }
    public void setDeltaPct(double deltaPct) { this.deltaPct = deltaPct; }
}
