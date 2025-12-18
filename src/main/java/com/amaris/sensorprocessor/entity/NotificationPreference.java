package com.amaris.sensorprocessor.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NotificationPreference {
    private Long id;
    private String username;
    private String parameterType;
    private boolean emailEnabled;
    private boolean smsEnabled;
    private String customEmail;
    private String customPhone;
}
