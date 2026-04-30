package com.amaris.sensorprocessor.repository;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SensorLorawanDaoTest {

    @Test
    @SuppressWarnings("unchecked")
    void buildPayloadFormatterRequestTargetsUplinkFormatterFields() {
        Map<String, Object> request = SensorLorawanDao.buildPayloadFormatterRequest(
                "building-appli",
                "co2-office-01",
                "function decodeUplink(input) { return { data: {} }; }"
        );

        Map<String, Object> endDevice = (Map<String, Object>) request.get("end_device");
        Map<String, Object> ids = (Map<String, Object>) endDevice.get("ids");
        Map<String, Object> applicationIds = (Map<String, Object>) ids.get("application_ids");
        Map<String, Object> formatters = (Map<String, Object>) endDevice.get("formatters");
        Map<String, Object> fieldMask = (Map<String, Object>) request.get("field_mask");

        assertEquals("co2-office-01", ids.get("device_id"));
        assertEquals("building-appli", applicationIds.get("application_id"));
        assertEquals("FORMATTER_JAVASCRIPT", formatters.get("up_formatter"));
        assertEquals("function decodeUplink(input) { return { data: {} }; }", formatters.get("up_formatter_parameter"));
        assertEquals(
                List.of("formatters.up_formatter", "formatters.up_formatter_parameter"),
                fieldMask.get("paths")
        );
    }
}
