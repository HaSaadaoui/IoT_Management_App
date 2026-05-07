package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.GatewayRebootSchedule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
        dao.save(new GatewayRebootSchedule("rpi-mantu", true, 180));

        Optional<GatewayRebootSchedule> inserted = dao.findByGatewayId("rpi-mantu");
        assertTrue(inserted.isPresent());
        assertTrue(inserted.get().isEnabled());
        assertEquals(180, inserted.get().getIntervalMinutes());

        dao.save(new GatewayRebootSchedule("rpi-mantu", false, 60));

        GatewayRebootSchedule updated = dao.findByGatewayId("rpi-mantu").orElseThrow();
        assertFalse(updated.isEnabled());
        assertEquals(60, updated.getIntervalMinutes());
    }

    @Test
    void findEnabledReturnsOnlyEnabledSchedules() {
        dao.save(new GatewayRebootSchedule("enabled-gateway", true, 30));
        dao.save(new GatewayRebootSchedule("disabled-gateway", false, 45));

        List<GatewayRebootSchedule> enabled = dao.findEnabled();

        assertEquals(1, enabled.size());
        assertEquals("enabled-gateway", enabled.get(0).getGatewayId());
    }
}
