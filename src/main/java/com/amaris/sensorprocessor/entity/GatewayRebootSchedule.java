package com.amaris.sensorprocessor.entity;

public class GatewayRebootSchedule {

    private String gatewayId;
    private boolean enabled;
    private int intervalMinutes;

    public GatewayRebootSchedule() {
    }

    public GatewayRebootSchedule(String gatewayId, boolean enabled, int intervalMinutes) {
        this.gatewayId = gatewayId;
        this.enabled = enabled;
        this.intervalMinutes = intervalMinutes;
    }

    public String getGatewayId() {
        return gatewayId;
    }

    public void setGatewayId(String gatewayId) {
        this.gatewayId = gatewayId;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getIntervalMinutes() {
        return intervalMinutes;
    }

    public void setIntervalMinutes(int intervalMinutes) {
        this.intervalMinutes = intervalMinutes;
    }
}
