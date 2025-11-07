package com.amaris.sensorprocessor.entity.SensorData;


import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import com.amaris.sensorprocessor.entity.Sensor;

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
        this.valueType = EnumValueType.valueOf(valueType);
    }

    @Id
    @Column("id_sensor")
    private String idSensor;

    @Id
    @Column("created_at")
    private LocalDateTime createdAt;

    @Column("string_value")
    private String asString;

    // @Column("numeric_value")
    // private Number asNumber;

    @Column("value_type")
    @Enumerated(EnumType.STRING)
    private EnumValueType valueType;

    // @ManyToOne
    // private Sensor sensor;

}
