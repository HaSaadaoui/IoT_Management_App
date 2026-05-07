package com.amaris.sensorprocessor.entity;

import lombok.Data;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

@Data
@Table("gateway_data")
public class GatewayData {

    public GatewayData(String idGateway, LocalDateTime receivedAt, String asString, GatewayValueType valueType) {
        this.idGateway = idGateway;
        this.receivedAt = receivedAt;
        this.asString = asString;
        this.valueType = valueType;
    }

    public GatewayData(String idGateway, LocalDateTime receivedAt, String asString, String valueType) {
        this(idGateway, receivedAt, asString, GatewayValueType.valueOf(valueType));
    }

    @Id
    @Column("id")
    private Long id;

    @Column("id_gateway")
    private String idGateway;

    @Column("received_at")
    private LocalDateTime receivedAt;

    @Column("value")
    private String asString;

    @Column("value_type")
    private GatewayValueType valueType;

    public String getValueAsString() {
        return asString;
    }

    public Integer getValueAsInt() {
        try {
            return Integer.parseInt(asString);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public Double getValueAsDouble() {
        try {
            return Double.parseDouble(asString);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public Boolean getValueAsBoolean() {
        if (asString == null) {
            return null;
        }
        return "true".equalsIgnoreCase(asString)
                || "1".equals(asString)
                || "active".equalsIgnoreCase(asString);
    }
}
