package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.Gateway;
import com.amaris.sensorprocessor.entity.GatewayRebootSchedule;
import com.amaris.sensorprocessor.repository.GatewayRebootScheduleDao;
import org.junit.jupiter.api.Test;

import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class GatewayRebootSchedulerServiceTest {

    private final GatewayRebootScheduleDao scheduleDao = mock(GatewayRebootScheduleDao.class);
    private final GatewayService gatewayService = mock(GatewayService.class);
    private final GatewayRebootSchedulerService service =
            new GatewayRebootSchedulerService(scheduleDao, gatewayService);

    @Test
    void saveSchedulePersistsConfiguration() {
        Gateway gateway = new Gateway("rpi-mantu", "eui", "10.0.0.1", 1, "EU", "2024-01-01", 1, 1, null, null, null);
        when(gatewayService.findById("rpi-mantu")).thenReturn(Optional.of(gateway));

        GatewayRebootSchedule saved = service.saveSchedule("rpi-mantu", false, 1, LocalTime.parse(String.valueOf(LocalTime.of(3, 0))));

        assertEquals("rpi-mantu", saved.getGatewayId());
        assertFalse(saved.isEnabled());
        assertEquals(1, saved.getDayOfWeek());
        assertEquals(LocalTime.of(3, 0), saved.getRebootTime());
        verify(scheduleDao).save(any(GatewayRebootSchedule.class));
    }

    @Test
    void saveScheduleRejectsInvalidDayOfWeek() {
        Gateway gateway = new Gateway("rpi-mantu", "eui", "10.0.0.1", 1, "EU", "2024-01-01", 1, 1, null, null, null);
        when(gatewayService.findById("rpi-mantu")).thenReturn(Optional.of(gateway));

        assertThrows(IllegalArgumentException.class,
                () -> service.saveSchedule("rpi-mantu", true, 7, LocalTime.parse(String.valueOf(LocalTime.of(0, 0)))));
    }

    @Test
    void restartNowUsesGatewayIpAddress() {
        Gateway gateway = new Gateway("rpi-mantu", "eui", "10.0.0.1", 1, "EU", "2024-01-01", 1, 1, null, null, null);
        when(gatewayService.findById("rpi-mantu")).thenReturn(Optional.of(gateway));
        when(gatewayService.restartGateway("rpi-mantu", "10.0.0.1")).thenReturn("Restart requested");

        String result = service.restartNow("rpi-mantu");

        assertEquals("Restart requested", result);
        verify(gatewayService).restartGateway("rpi-mantu", "10.0.0.1");
    }

    @Test
    void findAllGatewaySchedulesAddsDefaultsForMissingConfiguration() {
        Gateway gateway = new Gateway("rpi-mantu", "eui", "10.0.0.1", 1, "EU", "2024-01-01", 1, 1, null, null, null);
        when(gatewayService.getAllGateways()).thenReturn(List.of(gateway));
        when(gatewayService.isGatewayRestarting("rpi-mantu")).thenReturn(false);
        when(gatewayService.getGatewayRestartRemainingSeconds("rpi-mantu")).thenReturn(0L);
        when(scheduleDao.findAll()).thenReturn(List.of());

        List<Map<String, Object>> schedules = service.findAllGatewaySchedules();

        assertEquals(1, schedules.size());
        assertEquals("rpi-mantu", schedules.get(0).get("gatewayId"));
        assertEquals(false, schedules.get(0).get("enabled"));
        assertEquals(1, schedules.get(0).get("dayOfWeek"));
        assertEquals("00:00", schedules.get(0).get("rebootTime"));
    }
}