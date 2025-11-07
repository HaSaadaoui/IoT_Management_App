package com.amaris.sensorprocessor.entity;


import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.ManyToOne;

@Data
@Table("sensor_data")
public class SensorData {

    // Constructor
    public SensorData(String idSensor, LocalDateTime createdAt, String asString, String valueType) {
        this.idSensor = idSensor;
        this.createdAt = createdAt;
        this.asString = asString;
        this.valueType = PayloadValueType.valueOf(valueType);
    }

    @Id
    @Column("id_sensor")
    private String idSensor;

    @Id
    @Column("created_at")
    private LocalDateTime createdAt;

    @Column("string_value")
    private String asString;

    @Column("value_type")
    @Enumerated(EnumType.STRING)
    private PayloadValueType valueType;

    @ManyToOne
    private Sensor sensor;

}
