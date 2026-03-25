package com.amaris.sensorprocessor.model.prediction;

public class PredictionRequest {
    private String buildingId;
    private String floor;

    public String getBuildingId() { return buildingId; }
    public void setBuildingId(String buildingId) { this.buildingId = buildingId; }

    public String getFloor() { return floor; }
    public void setFloor(String floor) { this.floor = floor; }
}
