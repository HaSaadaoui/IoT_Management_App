package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.GatewayRebootSchedule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class GatewayRebootScheduleDaoTest {

    private GatewayRebootScheduleDao dao;

    @BeforeEach
    void setUp() {
        SingleConnectionDataSource dataSource = new SingleConnectionDataSource("jdbc:sqlite::memory:", true);
        dao = new GatewayRebootScheduleDao(new JdbcTemplate(dataSource));
        dao.initializeTable();
    }

    @Test
    void saveInsertsAndUpdatesSchedule() {
        dao.save(new GatewayRebootSchedule("rpi-mantu", true, 1, LocalTime.of(3, 0)));

        Optional<GatewayRebootSchedule> inserted = dao.findByGatewayId("rpi-mantu");
        assertTrue(inserted.isPresent());
        assertTrue(inserted.get().isEnabled());
        assertEquals(1, inserted.get().getDayOfWeek());
        assertEquals(LocalTime.of(3, 0), inserted.get().getRebootTime());

        dao.save(new GatewayRebootSchedule("rpi-mantu", false, 3, LocalTime.of(2, 30)));

        GatewayRebootSchedule updated = dao.findByGatewayId("rpi-mantu").orElseThrow();
        assertFalse(updated.isEnabled());
        assertEquals(3, updated.getDayOfWeek());
        assertEquals(LocalTime.of(2, 30), updated.getRebootTime());
    }

    @Test
    void findEnabledReturnsOnlyEnabledSchedules() {
        dao.save(new GatewayRebootSchedule("enabled-gateway", true, 2, LocalTime.of(1, 0)));
        dao.save(new GatewayRebootSchedule("disabled-gateway", false, 4, LocalTime.of(4, 0)));

        List<GatewayRebootSchedule> enabled = dao.findEnabled();

        assertEquals(1, enabled.size());
        assertEquals("enabled-gateway", enabled.get(0).getGatewayId());
    }
}