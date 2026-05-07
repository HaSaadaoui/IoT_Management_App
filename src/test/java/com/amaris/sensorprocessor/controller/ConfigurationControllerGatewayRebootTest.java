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

import java.time.LocalTime;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

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
        GatewayRebootSchedule schedule = new GatewayRebootSchedule("rpi-mantu", true, 3, LocalTime.of(2, 0));
        when(gatewayRebootSchedulerService.saveSchedule("rpi-mantu", true, 3, LocalTime.parse(String.valueOf(LocalTime.of(2, 0)))))
                .thenReturn(schedule);

        ResponseEntity<?> response = controller.saveGatewayRebootSchedule(
                "rpi-mantu",
                Map.of("enabled", true, "dayOfWeek", 3, "rebootTime", "02:00")
        );

        assertEquals(HttpStatus.OK, response.getStatusCode());
        GatewayRebootSchedule body = (GatewayRebootSchedule) response.getBody();
        assertNotNull(body);
        assertEquals("rpi-mantu", body.getGatewayId());
        assertTrue(body.isEnabled());
        assertEquals(3, body.getDayOfWeek());
        assertEquals(LocalTime.of(2, 0), body.getRebootTime());
    }

    @Test
    void saveGatewayRebootScheduleReturnsBadRequestOnInvalidInput() {
        when(gatewayRebootSchedulerService.saveSchedule("rpi-mantu", true, 7, LocalTime.parse(String.valueOf(LocalTime.of(0, 0)))))
                .thenThrow(new IllegalArgumentException("dayOfWeek must be between 0 and 6"));

        ResponseEntity<?> response = controller.saveGatewayRebootSchedule(
                "rpi-mantu",
                Map.of("enabled", true, "dayOfWeek", 7, "rebootTime", "00:00")
        );

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("dayOfWeek must be between 0 and 6", ((Map<?, ?>) response.getBody()).get("error"));
    }

    @Test
    void saveGatewayRebootScheduleReturnsBadRequestOnInvalidTime() {
        ResponseEntity<?> response = controller.saveGatewayRebootSchedule(
                "rpi-mantu",
                Map.of("enabled", true, "dayOfWeek", 1, "rebootTime", "bad-time")
        );

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("rebootTime must use HH:mm format", ((Map<?, ?>) response.getBody()).get("error"));
        verify(gatewayRebootSchedulerService, never()).saveSchedule(anyString(), anyBoolean(), anyInt(), any());
    }
}
