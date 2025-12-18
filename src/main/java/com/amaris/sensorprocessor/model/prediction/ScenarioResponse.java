// ScenarioResponse.java
package com.amaris.sensorprocessor.model.prediction;

import java.util.List;

public class ScenarioResponse {
    private String horizon;
    private String baseTimestamp;
    private List<ScenarioPoint> scenarios;
    private String modelVersion;

    public String getHorizon() { return horizon; }
    public void setHorizon(String horizon) { this.horizon = horizon; }

    public String getBaseTimestamp() { return baseTimestamp; }
    public void setBaseTimestamp(String baseTimestamp) { this.baseTimestamp = baseTimestamp; }

    public List<ScenarioPoint> getScenarios() { return scenarios; }
    public void setScenarios(List<ScenarioPoint> scenarios) { this.scenarios = scenarios; }

    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String modelVersion) { this.modelVersion = modelVersion; }
}
