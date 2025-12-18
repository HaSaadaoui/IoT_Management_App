package com.amaris.sensorprocessor.model.prediction;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public class HistoricalResponse {

    private String t0;
    private String horizon;
    private String modelVersion;

    private List<String> timestamps;

    @JsonProperty("predicted_consumption")
    private List<Double> predictedConsumption;

    @JsonProperty("true_consumption")
    private List<Double> trueConsumption;

    @JsonProperty("abs_error")
    private List<Double> absError;

    public String getT0() {
        return t0;
    }

    public void setT0(String t0) {
        this.t0 = t0;
    }

    public String getHorizon() {
        return horizon;
    }

    public void setHorizon(String horizon) {
        this.horizon = horizon;
    }

    public String getModelVersion() {
        return modelVersion;
    }

    @JsonProperty("model_version")
    public void setModelVersion(String modelVersion) {
        this.modelVersion = modelVersion;
    }

    public List<String> getTimestamps() {
        return timestamps;
    }

    public void setTimestamps(List<String> timestamps) {
        this.timestamps = timestamps;
    }

    public List<Double> getPredictedConsumption() {
        return predictedConsumption;
    }

    public void setPredictedConsumption(List<Double> predictedConsumption) {
        this.predictedConsumption = predictedConsumption;
    }

    public List<Double> getTrueConsumption() {
        return trueConsumption;
    }

    public void setTrueConsumption(List<Double> trueConsumption) {
        this.trueConsumption = trueConsumption;
    }

    public List<Double> getAbsError() {
        return absError;
    }

    public void setAbsError(List<Double> absError) {
        this.absError = absError;
    }
}
