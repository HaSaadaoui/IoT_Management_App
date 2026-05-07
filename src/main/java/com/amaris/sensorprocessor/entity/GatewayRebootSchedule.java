package com.amaris.sensorprocessor.entity;

import java.time.LocalTime;

public class GatewayRebootSchedule {

    private String gatewayId;
    private boolean enabled;
    private int dayOfWeek;
    private LocalTime rebootTime;

    public GatewayRebootSchedule() {
    }

    public GatewayRebootSchedule(String gatewayId, boolean enabled, int dayOfWeek, LocalTime rebootTime) {
        this.gatewayId = gatewayId;
        this.enabled = enabled;
        this.dayOfWeek = dayOfWeek;
        this.rebootTime = rebootTime;
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

    public int getDayOfWeek() {
        return dayOfWeek;
    }

    public void setDayOfWeek(int dayOfWeek) {
        this.dayOfWeek = dayOfWeek;
    }

    public LocalTime getRebootTime() {
        return rebootTime;
    }

    public void setRebootTime(LocalTime rebootTime) {
        this.rebootTime = rebootTime;
    }
}
