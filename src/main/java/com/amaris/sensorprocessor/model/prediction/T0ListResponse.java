package com.amaris.sensorprocessor.model.prediction;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public class T0ListResponse {

    @JsonProperty("t0_list")
    private List<String> t0List;

    private int count;

    @JsonProperty("source_blob")
    private String sourceBlob;

    private String status;

    public List<String> getT0List() {
        return t0List;
    }

    public void setT0List(List<String> t0List) {
        this.t0List = t0List;
    }

    public int getCount() {
        return count;
    }

    public void setCount(int count) {
        this.count = count;
    }

    public String getSourceBlob() {
        return sourceBlob;
    }

    public void setSourceBlob(String sourceBlob) {
        this.sourceBlob = sourceBlob;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
