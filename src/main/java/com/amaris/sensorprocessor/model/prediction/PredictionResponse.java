package com.amaris.sensorprocessor.model.prediction;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public class PredictionResponse {

    // список временных меток (строки ISO из FastAPI)
    private List<String> timestamps;

    // поле predicted_consumption из JSON → predictedConsumption
    @JsonProperty("predicted_consumption")
    private List<Double> predictedConsumption;

    // необязательное: версия модели (если отдает FastAPI)
    @JsonProperty("model_version")
    private String modelVersion;

    // необязательное: горизонт, если Python его возвращает (может быть null)
    @JsonProperty("horizon")
    private String horizon;

    // ===== getters / setters =====

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

    public String getModelVersion() {
        return modelVersion;
    }

    public void setModelVersion(String modelVersion) {
        this.modelVersion = modelVersion;
    }

    public String getHorizon() {
        return horizon;
    }

    public void setHorizon(String horizon) {
        this.horizon = horizon;
    }
}
