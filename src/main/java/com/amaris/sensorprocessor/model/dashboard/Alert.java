package com.amaris.sensorprocessor.model.dashboard;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class Alert {
    private String level;
    private String icon;
    private String title;
    private String message;
    private String time;
}
