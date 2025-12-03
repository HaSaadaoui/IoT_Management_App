// ScenarioPoint.java
package com.amaris.sensorprocessor.model.prediction;

public class ScenarioPoint {
    private String scenario;
    private double predictedConsumption;
    private double delta;
    private double deltaPct;

    public String getScenario() { return scenario; }
    public void setScenario(String scenario) { this.scenario = scenario; }

    public double getPredictedConsumption() { return predictedConsumption; }
    public void setPredictedConsumption(double predictedConsumption) {
        this.predictedConsumption = predictedConsumption;
    }

    public double getDelta() { return delta; }
    public void setDelta(double delta) { this.delta = delta; }

    public double getDeltaPct() { return deltaPct; }
    public void setDeltaPct(double deltaPct) { this.deltaPct = deltaPct; }
}
