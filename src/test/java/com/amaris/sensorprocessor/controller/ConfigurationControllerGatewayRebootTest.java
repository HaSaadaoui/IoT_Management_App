package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.config.AlertThresholdConfig;
import com.amaris.sensorprocessor.entity.GatewayRebootSchedule;
import com.amaris.sensorprocessor.repository.AlertConfigurationDao;
import com.amaris.sensorprocessor.repository.BuildingEnergyConfigDao;
import com.amaris.sensorprocessor.repository.GatewayDao;
import com.amaris.sensorprocessor.repository.SensorDao;
import com.amaris.sensorprocessor.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ConfigurationControllerGatewayRebootTest {

    private final GatewayRebootSchedulerService gatewayRebootSchedulerService = mock(GatewayRebootSchedulerService.class);
    private final ConfigurationController controller = new ConfigurationController(
            mock(AlertThresholdConfig.class),
            mock(AlertConfigurationService.class),
            mock(NotificationService.class),
            mock(SensorThresholdService.class),
            mock(UserService.class),
            mock(SensorDao.class),
            mock(GatewayDao.class),
            mock(AlertConfigurationDao.class),
            mock(BrandService.class),
            mock(ProtocolService.class),
            mock(DeviceTypeService.class),
            mock(SensorService.class),
            mock(BuildingEnergyConfigDao.class),
            mock(BuildingService.class),
            mock(LocationService.class),
            gatewayRebootSchedulerService,
            mock(DatabaseConnectionConfigService.class),
            mock(ApplicationRestartService.class)
    );

    @Test
    void restartGatewayFromConfigurationReturnsSuccess() {
        when(gatewayRebootSchedulerService.restartNow("rpi-mantu")).thenReturn("Restart requested");

        ResponseEntity<?> response = controller.restartGatewayFromConfiguration("rpi-mantu");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(true, ((Map<?, ?>) response.getBody()).get("success"));
        assertEquals("Restart requested", ((Map<?, ?>) response.getBody()).get("message"));
    }

    @Test
    void saveGatewayRebootScheduleReturnsSavedSchedule() {
        GatewayRebootSchedule schedule = new GatewayRebootSchedule("rpi-mantu", true, 4320);
        when(gatewayRebootSchedulerService.saveSchedule("rpi-mantu", true, 4320)).thenReturn(schedule);

        ResponseEntity<?> response = controller.saveGatewayRebootSchedule(
                "rpi-mantu",
                Map.of("enabled", true, "intervalMinutes", 4320)
        );

        assertEquals(HttpStatus.OK, response.getStatusCode());
        GatewayRebootSchedule body = (GatewayRebootSchedule) response.getBody();
        assertNotNull(body);
        assertEquals("rpi-mantu", body.getGatewayId());
        assertTrue(body.isEnabled());
        assertEquals(4320, body.getIntervalMinutes());
    }

    @Test
    void saveGatewayRebootScheduleReturnsBadRequestOnInvalidInput() {
        when(gatewayRebootSchedulerService.saveSchedule("rpi-mantu", true, 0))
                .thenThrow(new IllegalArgumentException("Interval must be at least 1 minute"));

        ResponseEntity<?> response = controller.saveGatewayRebootSchedule(
                "rpi-mantu",
                Map.of("enabled", true, "intervalMinutes", 0)
        );

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("Interval must be at least 1 minute", ((Map<?, ?>) response.getBody()).get("error"));
    }
}
